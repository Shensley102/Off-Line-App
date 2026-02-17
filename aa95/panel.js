/**
 * AA95 Audio Control Panel - Photo Cutout Controller
 * Drives actual hardware photo segments with transforms
 */

(function() {
  'use strict';

  // ============================================
  // CONFIGURATION
  // ============================================
  
  const CONFIG = {
    selector: {
      positions: ['COM1', 'COM2', 'FM1', 'FM2', 'AUX', 'PA'],
      angles: [-130, -80, -30, 20, 70, 120] // Exact rotation degrees
    },
    volume: {
      min: 0,
      max: 100,
      angleMin: -150,
      angleMax: 150,
      sensitivity: 0.5
    },
    masterCheck: {
      toggleIds: ['com1', 'com2', 'fm1', 'fm2', 'aux'],
      staggerDelay: 150 // ms between each toggle
    }
  };

  // ============================================
  // UTILITIES
  // ============================================
  
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);
  const $id = (id) => document.getElementById(id);
  
  const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
  const mapRange = (v, inMin, inMax, outMin, outMax) => 
    ((v - inMin) / (inMax - inMin)) * (outMax - outMin) + outMin;

  function setStatus(text) {
    const el = $id('statusText');
    if (el) el.textContent = text;
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ============================================
  // MASTER CHECK - Sequential Startup Simulation
  // Updates data-active attributes which triggers CSS
  // ============================================
  
  async function executeMasterCheck() {
    const { toggleIds, staggerDelay } = CONFIG.masterCheck;
    
    setStatus('▶ MASTER CHECK: Initiating...');
    
    // Phase 1: All toggles DOWN (off)
    toggleIds.forEach(id => {
      const el = $id(id);
      if (el) el.dataset.active = 'false';
    });
    updateIndicators();
    
    await sleep(400);
    setStatus('▶ MASTER CHECK: Resetting switches...');
    await sleep(300);
    
    // Phase 2: Sequential activation with stagger
    for (let i = 0; i < toggleIds.length; i++) {
      const id = toggleIds[i];
      const el = $id(id);
      
      if (el) {
        // Update the data attribute - CSS handles the visual via Shadow Shift
        el.dataset.active = 'true';
        
        // Status feedback
        const label = el.dataset.label || id.toUpperCase();
        setStatus(`▶ CHECKING: ${label} UP ✓`);
        
        // Update indicators after each toggle
        updateIndicators();
      }
      
      // Stagger delay before next toggle
      await sleep(staggerDelay);
    }
    
    // Phase 3: Completion
    await sleep(200);
    setStatus('✓ MASTER CHECK COMPLETE - All Audio Paths Active');
    
    // Flash TX light to confirm
    const txLight = $id('tx_light');
    if (txLight) {
      txLight.dataset.active = 'false';
      await sleep(100);
      txLight.dataset.active = 'true';
      await sleep(100);
      txLight.dataset.active = 'false';
      await sleep(100);
      txLight.dataset.active = 'true';
    }
  }

  function initMasterCheckButton() {
    const btn = $id('masterCheckBtn');
    if (btn) {
      btn.addEventListener('click', () => {
        executeMasterCheck();
      });
    }
  }

  // ============================================
  // TOGGLE SWITCHES
  // ============================================
  
  function initToggles() {
    $$('.hotspot.toggle').forEach(toggle => {
      toggle.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const isActive = toggle.dataset.active === 'true';
        toggle.dataset.active = (!isActive).toString();
        
        const label = toggle.dataset.label || toggle.id.toUpperCase();
        setStatus(`${label}: ${toggle.dataset.active === 'true' ? 'ON (UP)' : 'OFF (DOWN)'}`);
        
        updateIndicators();
      });
    });
  }

  // ============================================
  // BUTTONS
  // ============================================
  
  function initButtons() {
    // Standard toggle buttons (ADF, DPLR, SO)
    $$('.hotspot.button.round:not(.momentary):not(.iso-emr)').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const isActive = btn.dataset.active === 'true';
        btn.dataset.active = (!isActive).toString();
        setStatus(`${btn.dataset.label}: ${btn.dataset.active === 'true' ? 'ON' : 'OFF'}`);
      });
    });
    
    // ISO/EMR button
    const isoEmr = $id('iso_emr');
    if (isoEmr) {
      isoEmr.addEventListener('click', (e) => {
        e.preventDefault();
        const mode = isoEmr.dataset.mode === 'emr' ? 'normal' : 'emr';
        isoEmr.dataset.mode = mode;
        isoEmr.dataset.active = (mode === 'emr').toString();
        setStatus(`ISO/EMR: ${mode.toUpperCase()}`);
      });
    }
    
    // ICS CALL (momentary with press effect)
    initIcsCallButton();
  }

  function initIcsCallButton() {
    const btn = $id('ics_call');
    if (!btn) return;
    
    const press = () => {
      btn.dataset.active = 'true';
      setStatus('ICS CALL: PRESSED');
    };
    
    const release = () => {
      btn.dataset.active = 'false';
      setStatus('ICS CALL: RELEASED');
    };
    
    // Mouse events
    btn.addEventListener('mousedown', (e) => { e.preventDefault(); press(); });
    btn.addEventListener('mouseup', release);
    btn.addEventListener('mouseleave', release);
    
    // Touch events
    btn.addEventListener('touchstart', (e) => { e.preventDefault(); press(); }, { passive: false });
    btn.addEventListener('touchend', (e) => { e.preventDefault(); release(); });
    btn.addEventListener('touchcancel', release);
  }

  // ============================================
  // SELECTOR KNOB - Photo Cutout Rotation
  // Snaps to detent positions like real hardware
  // ============================================
  
  function initSelector() {
    const selector = $id('selector');
    if (!selector) return;
    
    const cutout = selector.querySelector('.cutout');
    let isDragging = false;
    let startY = 0;
    let startAngle = parseFloat(selector.dataset.angle) || -130;
    
    function findNearestPosition(angle) {
      let nearestIdx = 0;
      let nearestDist = Infinity;
      
      CONFIG.selector.angles.forEach((a, i) => {
        const dist = Math.abs(angle - a);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestIdx = i;
        }
      });
      
      return {
        index: nearestIdx,
        angle: CONFIG.selector.angles[nearestIdx],
        position: CONFIG.selector.positions[nearestIdx],
        distance: nearestDist
      };
    }
    
    function setAngle(angle, snap = false) {
      // Clamp to valid range
      const minAngle = CONFIG.selector.angles[0];
      const maxAngle = CONFIG.selector.angles[CONFIG.selector.angles.length - 1];
      angle = clamp(angle, minAngle, maxAngle);
      
      // Find nearest detent position
      const nearest = findNearestPosition(angle);
      
      // If snapping, use exact position angle for perfect alignment
      const finalAngle = snap ? nearest.angle : angle;
      
      // Update state
      selector.dataset.angle = finalAngle;
      selector.dataset.position = nearest.position;
      
      // Apply rotation to the actual photo cutout
      // This keeps the knob's markings aligned with panel labels
      if (cutout) {
        cutout.style.transform = `rotate(${finalAngle}deg)`;
      }
      
      setStatus(`SELECTOR: ${nearest.position}`);
    }
    
    function snapToNearest() {
      // Remove dragging class to enable snap transition
      selector.classList.remove('dragging');
      
      const currentAngle = parseFloat(selector.dataset.angle) || -130;
      setAngle(currentAngle, true);
    }
    
    // Click to cycle through positions
    selector.addEventListener('click', (e) => {
      if (isDragging) return;
      e.preventDefault();
      
      const currentPos = selector.dataset.position || 'COM1';
      const currentIdx = CONFIG.selector.positions.indexOf(currentPos);
      const nextIdx = (currentIdx + 1) % CONFIG.selector.positions.length;
      setAngle(CONFIG.selector.angles[nextIdx], true);
    });
    
    // Drag to rotate
    selector.addEventListener('mousedown', (e) => {
      e.preventDefault();
      isDragging = false;
      startY = e.clientY;
      startAngle = parseFloat(selector.dataset.angle) || -130;
      
      const onMove = (e) => {
        const deltaY = startY - e.clientY;
        if (Math.abs(deltaY) > 8) {
          if (!isDragging) {
            isDragging = true;
            // Add dragging class to disable snap transition during drag
            selector.classList.add('dragging');
          }
          setAngle(startAngle + deltaY * 0.8);
        }
      };
      
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        if (isDragging) {
          snapToNearest();
        }
        isDragging = false;
      };
      
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
    
    // Touch drag
    selector.addEventListener('touchstart', (e) => {
      isDragging = false;
      startY = e.touches[0].clientY;
      startAngle = parseFloat(selector.dataset.angle) || -130;
    }, { passive: true });
    
    selector.addEventListener('touchmove', (e) => {
      const deltaY = startY - e.touches[0].clientY;
      if (Math.abs(deltaY) > 8) {
        if (!isDragging) {
          isDragging = true;
          selector.classList.add('dragging');
        }
        setAngle(startAngle + deltaY * 0.8);
      }
    }, { passive: true });
    
    selector.addEventListener('touchend', () => {
      if (isDragging) {
        snapToNearest();
      }
      isDragging = false;
    });
    
    // Scroll wheel - direct position stepping
    selector.addEventListener('wheel', (e) => {
      e.preventDefault();
      const currentIdx = CONFIG.selector.positions.indexOf(selector.dataset.position || 'COM1');
      const dir = e.deltaY < 0 ? 1 : -1;
      const nextIdx = clamp(currentIdx + dir, 0, CONFIG.selector.positions.length - 1);
      setAngle(CONFIG.selector.angles[nextIdx], true);
    }, { passive: false });
    
    // Initialize rotation
    if (cutout) {
      cutout.style.transform = `rotate(${selector.dataset.angle || -130}deg)`;
    }
  }

  // ============================================
  // VOLUME KNOBS - Photo Cutout Rotation
  // ============================================
  
  function initVolumeKnobs() {
    $$('.hotspot.knob.volume').forEach(initVolumeKnob);
  }
  
  function initVolumeKnob(knob) {
    const { volume } = CONFIG;
    const label = knob.dataset.label || knob.id.toUpperCase();
    const cutout = knob.querySelector('.cutout');
    
    let isDragging = false;
    let startY = 0;
    let startValue = parseFloat(knob.dataset.value) || 50;
    
    function setValue(value) {
      value = clamp(Math.round(value), volume.min, volume.max);
      knob.dataset.value = value;
      
      const angle = mapRange(value, volume.min, volume.max, volume.angleMin, volume.angleMax);
      knob.dataset.angle = angle;
      
      // Apply rotation to photo cutout
      if (cutout) {
        cutout.style.transform = `rotate(${angle}deg)`;
      }
      
      setStatus(`${label}: ${value}%`);
    }
    
    // Click to toggle between 0 and 50
    knob.addEventListener('click', (e) => {
      if (isDragging) return;
      e.preventDefault();
      setValue(parseFloat(knob.dataset.value) < 50 ? 50 : 0);
    });
    
    // Drag to adjust
    knob.addEventListener('mousedown', (e) => {
      e.preventDefault();
      isDragging = false;
      startY = e.clientY;
      startValue = parseFloat(knob.dataset.value) || 50;
      
      const onMove = (e) => {
        const deltaY = startY - e.clientY;
        if (Math.abs(deltaY) > 5) {
          isDragging = true;
          setValue(startValue + deltaY * volume.sensitivity);
        }
      };
      
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        isDragging = false;
      };
      
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
    
    // Touch drag
    knob.addEventListener('touchstart', (e) => {
      isDragging = false;
      startY = e.touches[0].clientY;
      startValue = parseFloat(knob.dataset.value) || 50;
    }, { passive: true });
    
    knob.addEventListener('touchmove', (e) => {
      const deltaY = startY - e.touches[0].clientY;
      if (Math.abs(deltaY) > 5) {
        isDragging = true;
        setValue(startValue + deltaY * volume.sensitivity);
      }
    }, { passive: true });
    
    knob.addEventListener('touchend', () => { isDragging = false; });
    
    // Scroll wheel
    knob.addEventListener('wheel', (e) => {
      e.preventDefault();
      setValue(parseFloat(knob.dataset.value) + (e.deltaY < 0 ? 5 : -5));
    }, { passive: false });
    
    // Initialize rotation
    const initialAngle = mapRange(parseFloat(knob.dataset.value) || 50, volume.min, volume.max, volume.angleMin, volume.angleMax);
    if (cutout) {
      cutout.style.transform = `rotate(${initialAngle}deg)`;
    }
  }

  // ============================================
  // INDICATORS
  // ============================================
  
  function updateIndicators() {
    const audioToggles = ['com1', 'com2', 'fm1', 'fm2', 'aux'];
    const anyActive = audioToggles.some(id => $id(id)?.dataset.active === 'true');
    
    const txLight = $id('tx_light');
    if (txLight) txLight.dataset.active = anyActive.toString();
    
    const icsMic = $id('ics_mic');
    const pltLight = $id('plt_light');
    if (pltLight && icsMic) pltLight.dataset.active = icsMic.dataset.active;
  }

  // ============================================
  // KEYBOARD SHORTCUTS
  // ============================================
  
  function initKeyboard() {
    const keyMap = {
      '1': 'com1', '2': 'com2', '3': 'fm1', '4': 'fm2', '5': 'aux',
      's': 'selector', 'c': 'ics_call', 'm': 'masterCheck'
    };
    
    document.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      
      if (key === 'm') {
        executeMasterCheck();
        return;
      }
      
      const el = $id(keyMap[key]);
      if (!el) return;
      
      if (key === 'c') {
        el.dataset.active = 'true';
        setStatus('ICS CALL: PRESSED (key)');
      } else {
        el.click();
      }
    });
    
    document.addEventListener('keyup', (e) => {
      if (e.key.toLowerCase() === 'c') {
        const el = $id('ics_call');
        if (el) {
          el.dataset.active = 'false';
          setStatus('ICS CALL: RELEASED (key)');
        }
      }
    });
  }

  // ============================================
  // INITIALIZATION
  // ============================================
  
  function init() {
    initToggles();
    initButtons();
    initSelector();
    initVolumeKnobs();
    initMasterCheckButton();
    updateIndicators();
    initKeyboard();
    
    setStatus('AA95 Panel Ready - Click controls to interact');
    
    console.log('AA95 Panel initialized (Photo Cutout System)');
    console.log('Keyboard: 1-5 = Toggles, S = Selector, C = ICS Call, M = Master Check');
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose master check for external use
  window.AA95 = {
    executeMasterCheck,
    updateIndicators
  };

})();
