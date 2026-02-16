/**
 * AA95 Audio Control Panel - Interactive Controls
 * Photorealistic training simulator
 */

(function() {
  'use strict';

  // ============================================
  // STATE
  // ============================================
  
  const state = {
    // Toggle switches
    com1: true,
    com2: true,
    fm1: true,
    fm2: true,
    aux: true,
    pat: true,
    key: true,
    ics_mic: true,
    
    // Buttons
    adf: false,
    dplr: false,
    so: false,
    iso_emr: 'normal', // 'normal' or 'emr'
    
    // Knobs (angle in degrees)
    selector: -120, // COM1 position
    rxvol: 0,
    icsvol: 0,
    vox: 0,
    
    // Indicators
    tx_light: true,
    plt_light: true
  };

  // Selector positions (degrees from vertical)
  const SELECTOR_POSITIONS = {
    'COM1': -120,
    'COM2': -70,
    'FM1': -25,
    'FM2': 20,
    'AUX': 60,
    'PA': 110
  };

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================

  function $(id) {
    return document.getElementById(id);
  }

  function setStatus(text) {
    const statusEl = $('statusText');
    if (statusEl) {
      statusEl.textContent = text;
    }
  }

  function getAngleFromCenter(element, clientX, clientY) {
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const deltaX = clientX - centerX;
    const deltaY = clientY - centerY;
    let angle = Math.atan2(deltaX, -deltaY) * (180 / Math.PI);
    return angle;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function findNearestSelectorPosition(angle) {
    let nearest = 'COM1';
    let minDiff = Infinity;
    
    for (const [name, pos] of Object.entries(SELECTOR_POSITIONS)) {
      const diff = Math.abs(angle - pos);
      if (diff < minDiff) {
        minDiff = diff;
        nearest = name;
      }
    }
    
    return nearest;
  }

  // ============================================
  // TOGGLE SWITCHES
  // ============================================

  function initToggles() {
    const toggleIds = ['com1', 'com2', 'fm1', 'fm2', 'aux'];
    
    toggleIds.forEach(id => {
      const el = $(id);
      if (!el) return;
      
      el.addEventListener('click', () => {
        state[id] = !state[id];
        el.dataset.state = state[id] ? 'up' : 'down';
        setStatus(`${id.toUpperCase()}: ${state[id] ? 'ON' : 'OFF'}`);
        updateIndicators();
      });
      
      // Set initial state
      el.dataset.state = state[id] ? 'up' : 'down';
    });
  }

  function initSmallToggles() {
    const toggleIds = ['pat', 'key', 'ics_mic'];
    
    toggleIds.forEach(id => {
      const el = $(id);
      if (!el) return;
      
      el.addEventListener('click', () => {
        state[id] = !state[id];
        el.dataset.state = state[id] ? 'up' : 'down';
        setStatus(`${id.toUpperCase().replace('_', ' ')}: ${state[id] ? 'ON' : 'OFF'}`);
      });
      
      el.dataset.state = state[id] ? 'up' : 'down';
    });
  }

  // ============================================
  // BUTTONS
  // ============================================

  function initButtons() {
    // ADF button
    const adf = $('adf');
    if (adf) {
      adf.addEventListener('click', () => {
        state.adf = !state.adf;
        adf.dataset.state = state.adf ? 'on' : 'off';
        setStatus(`ADF: ${state.adf ? 'ON' : 'OFF'}`);
      });
    }
    
    // DPLR button
    const dplr = $('dplr');
    if (dplr) {
      dplr.addEventListener('click', () => {
        state.dplr = !state.dplr;
        dplr.dataset.state = state.dplr ? 'on' : 'off';
        setStatus(`DPLR: ${state.dplr ? 'ON' : 'OFF'}`);
      });
    }
    
    // SO button
    const so = $('so');
    if (so) {
      so.addEventListener('click', () => {
        state.so = !state.so;
        so.dataset.state = state.so ? 'on' : 'off';
        setStatus(`SO: ${state.so ? 'ON' : 'OFF'}`);
      });
    }
    
    // ISO/EMR button
    const isoEmr = $('iso_emr');
    if (isoEmr) {
      isoEmr.addEventListener('click', () => {
        state.iso_emr = state.iso_emr === 'normal' ? 'emr' : 'normal';
        isoEmr.dataset.state = state.iso_emr;
        setStatus(`ISO/EMR: ${state.iso_emr.toUpperCase()}`);
      });
    }
    
    // ICS CALL button (momentary)
    const icsCall = $('ics_call');
    if (icsCall) {
      icsCall.addEventListener('mousedown', () => {
        icsCall.classList.add('pressed');
        setStatus('ICS CALL: PRESSED');
      });
      
      icsCall.addEventListener('mouseup', () => {
        icsCall.classList.remove('pressed');
        setStatus('ICS CALL: RELEASED');
      });
      
      icsCall.addEventListener('mouseleave', () => {
        icsCall.classList.remove('pressed');
      });
      
      // Touch support
      icsCall.addEventListener('touchstart', (e) => {
        e.preventDefault();
        icsCall.classList.add('pressed');
        setStatus('ICS CALL: PRESSED');
      });
      
      icsCall.addEventListener('touchend', () => {
        icsCall.classList.remove('pressed');
        setStatus('ICS CALL: RELEASED');
      });
    }
  }

  // ============================================
  // ROTARY KNOBS
  // ============================================

  function initKnobs() {
    // Main selector knob
    initSelectorKnob();
    
    // Volume knobs
    initVolumeKnob('rxvol', 'RX VOL');
    initVolumeKnob('icsvol', 'ICS VOL');
    initVolumeKnob('vox', 'VOX');
  }

  function initSelectorKnob() {
    const knob = $('selector');
    if (!knob) return;
    
    const pointer = knob.querySelector('.knob-pointer');
    let isDragging = false;
    let startAngle = 0;
    let currentAngle = state.selector;
    
    function updatePointer() {
      if (pointer) {
        pointer.style.transform = `translateX(-50%) rotate(${currentAngle}deg)`;
      }
    }
    
    function handleStart(e) {
      isDragging = true;
      knob.classList.add('dragging');
      
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      startAngle = getAngleFromCenter(knob, clientX, clientY) - currentAngle;
      
      e.preventDefault();
    }
    
    function handleMove(e) {
      if (!isDragging) return;
      
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      
      let newAngle = getAngleFromCenter(knob, clientX, clientY) - startAngle;
      
      // Clamp to valid range
      newAngle = clamp(newAngle, -130, 120);
      
      currentAngle = newAngle;
      state.selector = currentAngle;
      updatePointer();
      
      // Find and display nearest position
      const position = findNearestSelectorPosition(currentAngle);
      setStatus(`SELECTOR: ${position}`);
    }
    
    function handleEnd() {
      if (!isDragging) return;
      isDragging = false;
      knob.classList.remove('dragging');
      
      // Snap to nearest position
      const position = findNearestSelectorPosition(currentAngle);
      currentAngle = SELECTOR_POSITIONS[position];
      state.selector = currentAngle;
      updatePointer();
      setStatus(`SELECTOR: ${position} (snapped)`);
    }
    
    // Mouse events
    knob.addEventListener('mousedown', handleStart);
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleEnd);
    
    // Touch events
    knob.addEventListener('touchstart', handleStart, { passive: false });
    document.addEventListener('touchmove', handleMove, { passive: false });
    document.addEventListener('touchend', handleEnd);
    
    // Initialize position
    updatePointer();
  }

  function initVolumeKnob(id, label) {
    const knob = $(id);
    if (!knob) return;
    
    const pointer = knob.querySelector('.vol-pointer, .vox-pointer');
    let isDragging = false;
    let startAngle = 0;
    let currentAngle = state[id];
    
    function updatePointer() {
      if (pointer) {
        pointer.style.transform = `translateX(-50%) rotate(${currentAngle}deg)`;
      }
    }
    
    function handleStart(e) {
      isDragging = true;
      knob.classList.add('dragging');
      
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      startAngle = getAngleFromCenter(knob, clientX, clientY) - currentAngle;
      
      e.preventDefault();
    }
    
    function handleMove(e) {
      if (!isDragging) return;
      
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      
      let newAngle = getAngleFromCenter(knob, clientX, clientY) - startAngle;
      
      // Clamp to valid range (-150 to +150 degrees)
      newAngle = clamp(newAngle, -150, 150);
      
      currentAngle = newAngle;
      state[id] = currentAngle;
      updatePointer();
      
      // Convert to percentage for display
      const percent = Math.round(((currentAngle + 150) / 300) * 100);
      setStatus(`${label}: ${percent}%`);
    }
    
    function handleEnd() {
      if (!isDragging) return;
      isDragging = false;
      knob.classList.remove('dragging');
    }
    
    // Mouse events
    knob.addEventListener('mousedown', handleStart);
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleEnd);
    
    // Touch events
    knob.addEventListener('touchstart', handleStart, { passive: false });
    document.addEventListener('touchmove', handleMove, { passive: false });
    document.addEventListener('touchend', handleEnd);
    
    // Mouse wheel support
    knob.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -5 : 5;
      currentAngle = clamp(currentAngle + delta, -150, 150);
      state[id] = currentAngle;
      updatePointer();
      
      const percent = Math.round(((currentAngle + 150) / 300) * 100);
      setStatus(`${label}: ${percent}%`);
    }, { passive: false });
    
    // Initialize position
    updatePointer();
  }

  // ============================================
  // INDICATORS
  // ============================================

  function updateIndicators() {
    // TX light is on when any audio source is active
    const anyActive = state.com1 || state.com2 || state.fm1 || state.fm2 || state.aux;
    state.tx_light = anyActive;
    
    const txLight = $('tx_light');
    if (txLight) {
      txLight.dataset.state = state.tx_light ? 'on' : 'off';
    }
    
    // PLT light (always on for now)
    const pltLight = $('plt_light');
    if (pltLight) {
      pltLight.dataset.state = state.plt_light ? 'on' : 'off';
    }
  }

  // ============================================
  // INITIALIZATION
  // ============================================

  function init() {
    initToggles();
    initSmallToggles();
    initButtons();
    initKnobs();
    updateIndicators();
    
    setStatus('AA95 Panel Ready - Click controls to interact');
    
    console.log('AA95 Panel initialized');
  }

  // Wait for DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
