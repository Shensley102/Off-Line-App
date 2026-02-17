/**
 * AA95 Audio Control Panel - Animation Controller
 * Drives CSS-rendered components with smooth animations
 */

(function() {
  'use strict';

  // ============================================
  // CONFIGURATION
  // ============================================
  
  const CONFIG = {
    selector: {
      positions: ['COM1', 'COM2', 'FM1', 'FM2', 'AUX', 'PA'],
      angles: [-130, -80, -30, 20, 70, 120]
    },
    volume: {
      min: 0,
      max: 100,
      angleMin: -150,
      angleMax: 150,
      sensitivity: 0.5
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
    
    // ICS CALL (momentary)
    const icsCall = $id('ics_call');
    if (icsCall) {
      const press = () => { icsCall.dataset.active = 'true'; setStatus('ICS CALL: PRESSED'); };
      const release = () => { icsCall.dataset.active = 'false'; setStatus('ICS CALL: RELEASED'); };
      
      icsCall.addEventListener('mousedown', (e) => { e.preventDefault(); press(); });
      icsCall.addEventListener('mouseup', release);
      icsCall.addEventListener('mouseleave', release);
      icsCall.addEventListener('touchstart', (e) => { e.preventDefault(); press(); });
      icsCall.addEventListener('touchend', (e) => { e.preventDefault(); release(); });
    }
  }

  // ============================================
  // SELECTOR KNOB
  // ============================================
  
  function initSelector() {
    const selector = $id('selector');
    if (!selector) return;
    
    const knobBody = selector.querySelector('.knob-body');
    let isDragging = false;
    let startY = 0;
    let startAngle = parseFloat(selector.dataset.angle) || -130;
    
    function setAngle(angle) {
      angle = clamp(angle, CONFIG.selector.angles[0], CONFIG.selector.angles[CONFIG.selector.angles.length - 1]);
      selector.dataset.angle = angle;
      knobBody.style.transform = `rotate(${angle}deg)`;
      
      // Find nearest position
      let nearestIdx = 0;
      let nearestDist = Infinity;
      CONFIG.selector.angles.forEach((a, i) => {
        const dist = Math.abs(angle - a);
        if (dist < nearestDist) { nearestDist = dist; nearestIdx = i; }
      });
      
      selector.dataset.position = CONFIG.selector.positions[nearestIdx];
      setStatus(`SELECTOR: ${CONFIG.selector.positions[nearestIdx]}`);
    }
    
    function snapToNearest() {
      const currentAngle = parseFloat(selector.dataset.angle) || -130;
      let nearestAngle = CONFIG.selector.angles[0];
      let nearestDist = Infinity;
      CONFIG.selector.angles.forEach(a => {
        const dist = Math.abs(currentAngle - a);
        if (dist < nearestDist) { nearestDist = dist; nearestAngle = a; }
      });
      setAngle(nearestAngle);
    }
    
    // Click to cycle
    selector.addEventListener('click', (e) => {
      if (isDragging) return;
      e.preventDefault();
      
      const currentPos = selector.dataset.position || 'COM1';
      const currentIdx = CONFIG.selector.positions.indexOf(currentPos);
      const nextIdx = (currentIdx + 1) % CONFIG.selector.positions.length;
      setAngle(CONFIG.selector.angles[nextIdx]);
    });
    
    // Drag
    selector.addEventListener('mousedown', (e) => {
      e.preventDefault();
      isDragging = false;
      startY = e.clientY;
      startAngle = parseFloat(selector.dataset.angle) || -130;
      
      const onMove = (e) => {
        const deltaY = startY - e.clientY;
        if (Math.abs(deltaY) > 10) {
          isDragging = true;
          setAngle(startAngle + deltaY * 0.5);
        }
      };
      
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        if (isDragging) snapToNearest();
        isDragging = false;
      };
      
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
    
    // Touch
    selector.addEventListener('touchstart', (e) => {
      isDragging = false;
      startY = e.touches[0].clientY;
      startAngle = parseFloat(selector.dataset.angle) || -130;
    }, { passive: true });
    
    selector.addEventListener('touchmove', (e) => {
      const deltaY = startY - e.touches[0].clientY;
      if (Math.abs(deltaY) > 10) {
        isDragging = true;
        setAngle(startAngle + deltaY * 0.5);
      }
    }, { passive: true });
    
    selector.addEventListener('touchend', () => {
      if (isDragging) snapToNearest();
      isDragging = false;
    });
    
    // Wheel
    selector.addEventListener('wheel', (e) => {
      e.preventDefault();
      const currentIdx = CONFIG.selector.positions.indexOf(selector.dataset.position || 'COM1');
      const dir = e.deltaY < 0 ? 1 : -1;
      const nextIdx = clamp(currentIdx + dir, 0, CONFIG.selector.positions.length - 1);
      setAngle(CONFIG.selector.angles[nextIdx]);
    }, { passive: false });
    
    // Initialize
    knobBody.style.transform = `rotate(${selector.dataset.angle || -130}deg)`;
  }

  // ============================================
  // VOLUME KNOBS
  // ============================================
  
  function initVolumeKnobs() {
    $$('.hotspot.knob.volume').forEach(initVolumeKnob);
  }
  
  function initVolumeKnob(knob) {
    const { volume } = CONFIG;
    const label = knob.dataset.label || knob.id.toUpperCase();
    const knobBody = knob.querySelector('.knob-body');
    
    let isDragging = false;
    let startY = 0;
    let startValue = parseFloat(knob.dataset.value) || 50;
    
    function setValue(value) {
      value = clamp(Math.round(value), volume.min, volume.max);
      knob.dataset.value = value;
      
      const angle = mapRange(value, volume.min, volume.max, volume.angleMin, volume.angleMax);
      knob.dataset.angle = angle;
      knobBody.style.transform = `rotate(${angle}deg)`;
      
      setStatus(`${label}: ${value}%`);
    }
    
    // Click to toggle 0/50
    knob.addEventListener('click', (e) => {
      if (isDragging) return;
      e.preventDefault();
      setValue(parseFloat(knob.dataset.value) < 50 ? 50 : 0);
    });
    
    // Drag
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
    
    // Touch
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
    
    // Wheel
    knob.addEventListener('wheel', (e) => {
      e.preventDefault();
      setValue(parseFloat(knob.dataset.value) + (e.deltaY < 0 ? 5 : -5));
    }, { passive: false });
    
    // Initialize
    const initialAngle = mapRange(parseFloat(knob.dataset.value) || 50, volume.min, volume.max, volume.angleMin, volume.angleMax);
    knobBody.style.transform = `rotate(${initialAngle}deg)`;
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
  // KEYBOARD
  // ============================================
  
  function initKeyboard() {
    const keyMap = { '1': 'com1', '2': 'com2', '3': 'fm1', '4': 'fm2', '5': 'aux', 's': 'selector', 'c': 'ics_call' };
    
    document.addEventListener('keydown', (e) => {
      const el = $id(keyMap[e.key.toLowerCase()]);
      if (!el) return;
      
      if (e.key.toLowerCase() === 'c') {
        el.dataset.active = 'true';
        setStatus('ICS CALL: PRESSED (key)');
      } else {
        el.click();
      }
    });
    
    document.addEventListener('keyup', (e) => {
      if (e.key.toLowerCase() === 'c') {
        const el = $id('ics_call');
        if (el) { el.dataset.active = 'false'; setStatus('ICS CALL: RELEASED (key)'); }
      }
    });
  }

  // ============================================
  // INIT
  // ============================================
  
  function init() {
    initToggles();
    initButtons();
    initSelector();
    initVolumeKnobs();
    updateIndicators();
    initKeyboard();
    setStatus('AA95 Panel Ready - Click controls to interact');
    console.log('AA95 Panel initialized with CSS animations');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
