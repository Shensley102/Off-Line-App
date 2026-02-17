/**
 * AA95 Audio Control Panel - Data-Driven Controller
 * 
 * All state is stored in DOM data attributes:
 * - data-active: boolean for toggles and buttons
 * - data-value: 0-100 for volume knobs
 * - data-angle: rotation degrees for knobs
 * - data-position: named position for selector
 * - data-mode: special modes (e.g., "emr" for ISO/EMR)
 */

(function() {
  'use strict';

  // ============================================
  // CONFIGURATION
  // ============================================
  
  const CONFIG = {
    // Selector knob positions and angles
    selector: {
      positions: ['COM1', 'COM2', 'FM1', 'FM2', 'AUX', 'PA'],
      angles: [-130, -80, -30, 20, 70, 120], // degrees for each position
      snapThreshold: 25 // degrees to snap to position
    },
    
    // Volume knob settings
    volume: {
      min: 0,
      max: 100,
      angleMin: -150,
      angleMax: 150,
      sensitivity: 0.5 // degrees per pixel of drag
    },
    
    // Animation
    transitionDuration: 150 // ms
  };

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================
  
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => document.querySelectorAll(selector);
  const $id = (id) => document.getElementById(id);

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function mapRange(value, inMin, inMax, outMin, outMax) {
    return ((value - inMin) / (inMax - inMin)) * (outMax - outMin) + outMin;
  }

  function setStatus(text) {
    const el = $id('statusText');
    if (el) el.textContent = text;
  }

  // ============================================
  // TOGGLE SWITCH CONTROLLER
  // ============================================
  
  function initToggles() {
    const toggles = $$('.hotspot.toggle');
    
    toggles.forEach(toggle => {
      // Click handler
      toggle.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Toggle the data-active attribute
        const isActive = toggle.dataset.active === 'true';
        toggle.dataset.active = (!isActive).toString();
        
        // Update status
        const label = toggle.dataset.label || toggle.id.toUpperCase();
        const state = toggle.dataset.active === 'true' ? 'ON (UP)' : 'OFF (DOWN)';
        setStatus(`${label}: ${state}`);
        
        // Update indicators
        updateIndicators();
      });
      
      // Touch support (prevent double-firing)
      toggle.addEventListener('touchend', (e) => {
        e.preventDefault();
      });
    });
  }

  // ============================================
  // BUTTON CONTROLLER
  // ============================================
  
  function initButtons() {
    // Standard toggle buttons
    const buttons = $$('.hotspot.button:not(.momentary):not(.iso-emr)');
    buttons.forEach(initToggleButton);
    
    // ISO/EMR special button
    initIsoEmrButton();
    
    // Momentary button (ICS CALL)
    initMomentaryButton();
  }

  function initToggleButton(button) {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const isActive = button.dataset.active === 'true';
      button.dataset.active = (!isActive).toString();
      
      const label = button.dataset.label || button.id.toUpperCase();
      setStatus(`${label}: ${button.dataset.active === 'true' ? 'ON' : 'OFF'}`);
    });
  }

  function initIsoEmrButton() {
    const button = $id('iso_emr');
    if (!button) return;
    
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Cycle through: normal -> emr -> normal
      const mode = button.dataset.mode === 'emr' ? 'normal' : 'emr';
      button.dataset.mode = mode;
      button.dataset.active = (mode === 'emr').toString();
      
      setStatus(`ISO/EMR: ${mode.toUpperCase()}`);
    });
  }

  function initMomentaryButton() {
    const button = $id('ics_call');
    if (!button) return;
    
    const label = button.dataset.label || 'ICS CALL';
    
    const press = () => {
      button.dataset.active = 'true';
      setStatus(`${label}: PRESSED`);
    };
    
    const release = () => {
      button.dataset.active = 'false';
      setStatus(`${label}: RELEASED`);
    };
    
    // Mouse events
    button.addEventListener('mousedown', (e) => { e.preventDefault(); press(); });
    button.addEventListener('mouseup', release);
    button.addEventListener('mouseleave', release);
    
    // Touch events
    button.addEventListener('touchstart', (e) => { e.preventDefault(); press(); });
    button.addEventListener('touchend', (e) => { e.preventDefault(); release(); });
    button.addEventListener('touchcancel', release);
  }

  // ============================================
  // SELECTOR KNOB CONTROLLER
  // ============================================
  
  function initSelector() {
    const selector = $id('selector');
    if (!selector) return;
    
    let isDragging = false;
    let startY = 0;
    let startAngle = parseFloat(selector.dataset.angle) || -130;
    
    function updateAngle(angle) {
      // Clamp to valid range
      angle = clamp(angle, CONFIG.selector.angles[0], CONFIG.selector.angles[CONFIG.selector.angles.length - 1]);
      
      // Store and apply
      selector.dataset.angle = angle;
      selector.style.setProperty('--knob-angle', angle);
      
      // Find nearest position
      let nearestIdx = 0;
      let nearestDist = Infinity;
      CONFIG.selector.angles.forEach((a, i) => {
        const dist = Math.abs(angle - a);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestIdx = i;
        }
      });
      
      const position = CONFIG.selector.positions[nearestIdx];
      selector.dataset.position = position;
      setStatus(`SELECTOR: ${position}`);
    }
    
    function snapToPosition() {
      const currentAngle = parseFloat(selector.dataset.angle) || -130;
      let nearestAngle = CONFIG.selector.angles[0];
      let nearestDist = Infinity;
      
      CONFIG.selector.angles.forEach(a => {
        const dist = Math.abs(currentAngle - a);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestAngle = a;
        }
      });
      
      // Animate snap
      selector.style.setProperty('--knob-angle', nearestAngle);
      selector.dataset.angle = nearestAngle;
    }
    
    // Click to cycle
    selector.addEventListener('click', (e) => {
      if (isDragging) return;
      e.preventDefault();
      
      const currentPos = selector.dataset.position || 'COM1';
      const currentIdx = CONFIG.selector.positions.indexOf(currentPos);
      const nextIdx = (currentIdx + 1) % CONFIG.selector.positions.length;
      
      selector.dataset.position = CONFIG.selector.positions[nextIdx];
      selector.dataset.angle = CONFIG.selector.angles[nextIdx];
      selector.style.setProperty('--knob-angle', CONFIG.selector.angles[nextIdx]);
      
      setStatus(`SELECTOR: ${CONFIG.selector.positions[nextIdx]}`);
    });
    
    // Drag start
    const onDragStart = (clientY) => {
      isDragging = false;
      startY = clientY;
      startAngle = parseFloat(selector.dataset.angle) || -130;
    };
    
    // Drag move
    const onDragMove = (clientY) => {
      const deltaY = startY - clientY;
      if (Math.abs(deltaY) > 10) {
        isDragging = true;
        const newAngle = startAngle + (deltaY * 0.5);
        updateAngle(newAngle);
      }
    };
    
    // Drag end
    const onDragEnd = () => {
      if (isDragging) {
        snapToPosition();
      }
      isDragging = false;
    };
    
    // Mouse events
    selector.addEventListener('mousedown', (e) => {
      e.preventDefault();
      onDragStart(e.clientY);
      
      const onMouseMove = (e) => onDragMove(e.clientY);
      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        onDragEnd();
      };
      
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
    
    // Touch events
    selector.addEventListener('touchstart', (e) => {
      onDragStart(e.touches[0].clientY);
    }, { passive: true });
    
    selector.addEventListener('touchmove', (e) => {
      onDragMove(e.touches[0].clientY);
    }, { passive: true });
    
    selector.addEventListener('touchend', onDragEnd);
    
    // Scroll wheel
    selector.addEventListener('wheel', (e) => {
      e.preventDefault();
      const currentPos = selector.dataset.position || 'COM1';
      const currentIdx = CONFIG.selector.positions.indexOf(currentPos);
      const direction = e.deltaY < 0 ? 1 : -1;
      const nextIdx = clamp(currentIdx + direction, 0, CONFIG.selector.positions.length - 1);
      
      selector.dataset.position = CONFIG.selector.positions[nextIdx];
      selector.dataset.angle = CONFIG.selector.angles[nextIdx];
      selector.style.setProperty('--knob-angle', CONFIG.selector.angles[nextIdx]);
      
      setStatus(`SELECTOR: ${CONFIG.selector.positions[nextIdx]}`);
    }, { passive: false });
    
    // Initialize
    selector.style.setProperty('--knob-angle', selector.dataset.angle || -130);
  }

  // ============================================
  // VOLUME KNOB CONTROLLER
  // ============================================
  
  function initVolumeKnobs() {
    const knobs = $$('.hotspot.knob.volume');
    knobs.forEach(initVolumeKnob);
  }

  function initVolumeKnob(knob) {
    const { volume } = CONFIG;
    const label = knob.dataset.label || knob.id.toUpperCase();
    
    let isDragging = false;
    let startY = 0;
    let startValue = parseFloat(knob.dataset.value) || 50;
    
    function updateValue(value) {
      value = clamp(Math.round(value), volume.min, volume.max);
      knob.dataset.value = value;
      
      // Calculate angle from value
      const angle = mapRange(value, volume.min, volume.max, volume.angleMin, volume.angleMax);
      knob.dataset.angle = angle;
      knob.style.setProperty('--knob-angle', angle);
      
      setStatus(`${label}: ${value}%`);
    }
    
    // Click to toggle between 0 and 50
    knob.addEventListener('click', (e) => {
      if (isDragging) return;
      e.preventDefault();
      
      const currentValue = parseFloat(knob.dataset.value) || 50;
      updateValue(currentValue < 50 ? 50 : 0);
    });
    
    // Drag start
    const onDragStart = (clientY) => {
      isDragging = false;
      startY = clientY;
      startValue = parseFloat(knob.dataset.value) || 50;
    };
    
    // Drag move (vertical delta)
    const onDragMove = (clientY) => {
      const deltaY = startY - clientY; // Up = positive
      if (Math.abs(deltaY) > 5) {
        isDragging = true;
        const newValue = startValue + (deltaY * volume.sensitivity);
        updateValue(newValue);
      }
    };
    
    // Drag end
    const onDragEnd = () => {
      isDragging = false;
    };
    
    // Mouse events
    knob.addEventListener('mousedown', (e) => {
      e.preventDefault();
      onDragStart(e.clientY);
      
      const onMouseMove = (e) => onDragMove(e.clientY);
      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        onDragEnd();
      };
      
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
    
    // Touch events
    knob.addEventListener('touchstart', (e) => {
      onDragStart(e.touches[0].clientY);
    }, { passive: true });
    
    knob.addEventListener('touchmove', (e) => {
      onDragMove(e.touches[0].clientY);
    }, { passive: true });
    
    knob.addEventListener('touchend', onDragEnd);
    
    // Scroll wheel
    knob.addEventListener('wheel', (e) => {
      e.preventDefault();
      const currentValue = parseFloat(knob.dataset.value) || 50;
      const delta = e.deltaY < 0 ? 5 : -5;
      updateValue(currentValue + delta);
    }, { passive: false });
    
    // Initialize angle from value
    const initialValue = parseFloat(knob.dataset.value) || 50;
    const initialAngle = mapRange(initialValue, volume.min, volume.max, volume.angleMin, volume.angleMax);
    knob.dataset.angle = initialAngle;
    knob.style.setProperty('--knob-angle', initialAngle);
  }

  // ============================================
  // INDICATOR LIGHTS
  // ============================================
  
  function updateIndicators() {
    // TX light: ON when any audio source toggle is active
    const audioToggles = ['com1', 'com2', 'fm1', 'fm2', 'aux'];
    const anyActive = audioToggles.some(id => {
      const el = $id(id);
      return el && el.dataset.active === 'true';
    });
    
    const txLight = $id('tx_light');
    if (txLight) {
      txLight.dataset.active = anyActive.toString();
    }
    
    // PLT light: Could be tied to ICS MIC state
    const icsMic = $id('ics_mic');
    const pltLight = $id('plt_light');
    if (pltLight && icsMic) {
      pltLight.dataset.active = icsMic.dataset.active;
    }
  }

  // ============================================
  // KEYBOARD SHORTCUTS (for testing)
  // ============================================
  
  function initKeyboard() {
    const keyMap = {
      '1': 'com1', '2': 'com2', '3': 'fm1', '4': 'fm2', '5': 'aux',
      's': 'selector', 'c': 'ics_call'
    };
    
    document.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      
      if (keyMap[key]) {
        const el = $id(keyMap[key]);
        if (!el) return;
        
        if (key === 'c') {
          // ICS CALL momentary
          el.dataset.active = 'true';
          setStatus('ICS CALL: PRESSED (key)');
        } else if (key === 's') {
          // Selector cycle
          el.click();
        } else {
          // Toggle
          el.click();
        }
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
    updateIndicators();
    initKeyboard();
    
    setStatus('AA95 Panel Ready - Click controls to interact');
    
    console.log('AA95 Audio Control Panel initialized (data-driven)');
    console.log('State is stored in DOM data-* attributes');
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
