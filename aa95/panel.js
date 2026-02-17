/**
 * AA95 Audio Control Panel - Interactive Controls
 * Photorealistic training simulator
 * 
 * The visual is 100% the photo. This JS handles invisible hotspot interactions.
 */

(function() {
  'use strict';

  // ============================================
  // STATE
  // ============================================
  
  const state = {
    // Toggle switches (true = UP, false = DOWN)
    com1: true,
    com2: true,
    fm1: true,
    fm2: true,
    aux: true,
    pat: true,
    key: true,
    ics_mic: true,
    
    // Buttons (true = ON, false = OFF)
    adf: false,
    dplr: false,
    so: false,
    
    // ISO/EMR special state
    iso_emr: 'normal', // 'normal' or 'emr'
    
    // Selector position
    selector: 'COM1', // COM1, COM2, FM1, FM2, AUX, PA
    
    // Volume knobs (0-100)
    rxvol: 50,
    icsvol: 50,
    vox: 50,
    
    // Indicators
    tx_light: true,
    plt_light: true
  };

  // Selector positions in order (clockwise from COM1)
  const SELECTOR_POSITIONS = ['COM1', 'COM2', 'FM1', 'FM2', 'AUX', 'PA'];

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

  function updateElementState(id, stateAttr, value) {
    const el = $(id);
    if (el) {
      el.dataset.state = value;
    }
  }

  // ============================================
  // TOGGLE SWITCHES
  // ============================================

  function initToggles() {
    const toggleIds = ['com1', 'com2', 'fm1', 'fm2', 'aux', 'pat', 'key', 'ics_mic'];
    
    toggleIds.forEach(id => {
      const el = $(id);
      if (!el) return;
      
      // Click handler
      el.addEventListener('click', (e) => {
        e.preventDefault();
        
        // Toggle state
        state[id] = !state[id];
        
        // Update visual
        el.dataset.state = state[id] ? 'up' : 'down';
        
        // Update status
        const label = el.dataset.label || id.toUpperCase();
        setStatus(`${label}: ${state[id] ? 'ON (UP)' : 'OFF (DOWN)'}`);
        
        // Update indicators
        updateIndicators();
      });
      
      // Touch support
      el.addEventListener('touchend', (e) => {
        e.preventDefault();
        el.click();
      });
      
      // Set initial state
      el.dataset.state = state[id] ? 'up' : 'down';
    });
  }

  // ============================================
  // BUTTONS
  // ============================================

  function initButtons() {
    // ADF button
    initToggleButton('adf');
    
    // DPLR button  
    initToggleButton('dplr');
    
    // SO button
    initToggleButton('so');
    
    // ISO/EMR button (special handling)
    initIsoEmrButton();
    
    // ICS CALL button (momentary)
    initMomentaryButton('ics_call');
  }

  function initToggleButton(id) {
    const el = $(id);
    if (!el) return;
    
    el.addEventListener('click', (e) => {
      e.preventDefault();
      
      state[id] = !state[id];
      el.dataset.state = state[id] ? 'on' : 'off';
      
      const label = el.dataset.label || id.toUpperCase();
      setStatus(`${label}: ${state[id] ? 'ON' : 'OFF'}`);
    });
    
    el.addEventListener('touchend', (e) => {
      e.preventDefault();
      el.click();
    });
    
    el.dataset.state = state[id] ? 'on' : 'off';
  }

  function initIsoEmrButton() {
    const el = $('iso_emr');
    if (!el) return;
    
    el.addEventListener('click', (e) => {
      e.preventDefault();
      
      state.iso_emr = state.iso_emr === 'normal' ? 'emr' : 'normal';
      el.dataset.state = state.iso_emr;
      
      setStatus(`ISO/EMR: ${state.iso_emr.toUpperCase()}`);
    });
    
    el.addEventListener('touchend', (e) => {
      e.preventDefault();
      el.click();
    });
    
    el.dataset.state = state.iso_emr;
  }

  function initMomentaryButton(id) {
    const el = $(id);
    if (!el) return;
    
    const label = el.dataset.label || id.toUpperCase();
    
    // Mouse events
    el.addEventListener('mousedown', (e) => {
      e.preventDefault();
      el.classList.add('active');
      setStatus(`${label}: PRESSED`);
    });
    
    el.addEventListener('mouseup', (e) => {
      e.preventDefault();
      el.classList.remove('active');
      setStatus(`${label}: RELEASED`);
    });
    
    el.addEventListener('mouseleave', () => {
      el.classList.remove('active');
    });
    
    // Touch events
    el.addEventListener('touchstart', (e) => {
      e.preventDefault();
      el.classList.add('active');
      setStatus(`${label}: PRESSED`);
    });
    
    el.addEventListener('touchend', (e) => {
      e.preventDefault();
      el.classList.remove('active');
      setStatus(`${label}: RELEASED`);
    });
  }

  // ============================================
  // SELECTOR KNOB
  // ============================================

  function initSelector() {
    const el = $('selector');
    if (!el) return;
    
    let isDragging = false;
    let startY = 0;
    let currentIndex = SELECTOR_POSITIONS.indexOf(state.selector);
    
    function updateSelector(index) {
      currentIndex = Math.max(0, Math.min(SELECTOR_POSITIONS.length - 1, index));
      state.selector = SELECTOR_POSITIONS[currentIndex];
      setStatus(`SELECTOR: ${state.selector}`);
    }
    
    // Click to cycle through positions
    el.addEventListener('click', (e) => {
      if (isDragging) return;
      e.preventDefault();
      
      currentIndex = (currentIndex + 1) % SELECTOR_POSITIONS.length;
      updateSelector(currentIndex);
    });
    
    // Drag support
    el.addEventListener('mousedown', (e) => {
      isDragging = false;
      startY = e.clientY;
    });
    
    el.addEventListener('mousemove', (e) => {
      if (e.buttons !== 1) return;
      
      const deltaY = startY - e.clientY;
      if (Math.abs(deltaY) > 20) {
        isDragging = true;
        const direction = deltaY > 0 ? 1 : -1;
        updateSelector(currentIndex + direction);
        startY = e.clientY;
      }
    });
    
    // Scroll wheel support
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      const direction = e.deltaY < 0 ? 1 : -1;
      updateSelector(currentIndex + direction);
    }, { passive: false });
    
    // Touch drag
    el.addEventListener('touchstart', (e) => {
      isDragging = false;
      startY = e.touches[0].clientY;
    }, { passive: true });
    
    el.addEventListener('touchmove', (e) => {
      const deltaY = startY - e.touches[0].clientY;
      if (Math.abs(deltaY) > 30) {
        isDragging = true;
        const direction = deltaY > 0 ? 1 : -1;
        updateSelector(currentIndex + direction);
        startY = e.touches[0].clientY;
      }
    }, { passive: true });
    
    // Initialize
    setStatus(`SELECTOR: ${state.selector}`);
  }

  // ============================================
  // VOLUME KNOBS
  // ============================================

  function initVolumeKnobs() {
    initVolumeKnob('rxvol', 'RX VOL');
    initVolumeKnob('icsvol', 'ICS VOL');
    initVolumeKnob('vox', 'VOX');
  }

  function initVolumeKnob(id, label) {
    const el = $(id);
    if (!el) return;
    
    let isDragging = false;
    let startY = 0;
    
    function updateVolume(delta) {
      state[id] = Math.max(0, Math.min(100, state[id] + delta));
      setStatus(`${label}: ${state[id]}%`);
    }
    
    // Click to toggle between 0 and 50
    el.addEventListener('click', (e) => {
      if (isDragging) return;
      e.preventDefault();
      
      state[id] = state[id] < 50 ? 50 : 0;
      setStatus(`${label}: ${state[id]}%`);
    });
    
    // Drag support
    el.addEventListener('mousedown', (e) => {
      isDragging = false;
      startY = e.clientY;
    });
    
    el.addEventListener('mousemove', (e) => {
      if (e.buttons !== 1) return;
      
      const deltaY = startY - e.clientY;
      if (Math.abs(deltaY) > 5) {
        isDragging = true;
        updateVolume(deltaY > 0 ? 2 : -2);
        startY = e.clientY;
      }
    });
    
    // Scroll wheel
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      updateVolume(e.deltaY < 0 ? 5 : -5);
    }, { passive: false });
    
    // Touch drag
    el.addEventListener('touchstart', (e) => {
      isDragging = false;
      startY = e.touches[0].clientY;
    }, { passive: true });
    
    el.addEventListener('touchmove', (e) => {
      const deltaY = startY - e.touches[0].clientY;
      if (Math.abs(deltaY) > 10) {
        isDragging = true;
        updateVolume(deltaY > 0 ? 3 : -3);
        startY = e.touches[0].clientY;
      }
    }, { passive: true });
  }

  // ============================================
  // INDICATORS
  // ============================================

  function updateIndicators() {
    // TX light: ON when any audio source toggle is UP
    const anyActive = state.com1 || state.com2 || state.fm1 || state.fm2 || state.aux;
    state.tx_light = anyActive;
    updateElementState('tx_light', 'state', state.tx_light ? 'on' : 'off');
    
    // PLT light: Always on for now (could be tied to other logic)
    updateElementState('plt_light', 'state', state.plt_light ? 'on' : 'off');
  }

  // ============================================
  // KEYBOARD SUPPORT (for training/testing)
  // ============================================

  function initKeyboard() {
    document.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      
      // Number keys 1-5 toggle COM1, COM2, FM1, FM2, AUX
      if (key >= '1' && key <= '5') {
        const toggles = ['com1', 'com2', 'fm1', 'fm2', 'aux'];
        const idx = parseInt(key) - 1;
        const el = $(toggles[idx]);
        if (el) el.click();
      }
      
      // S for selector cycle
      if (key === 's') {
        const el = $('selector');
        if (el) el.click();
      }
      
      // C for ICS CALL
      if (key === 'c') {
        const el = $('ics_call');
        if (el) {
          el.classList.add('active');
          setStatus('ICS CALL: PRESSED (key)');
        }
      }
    });
    
    document.addEventListener('keyup', (e) => {
      if (e.key.toLowerCase() === 'c') {
        const el = $('ics_call');
        if (el) {
          el.classList.remove('active');
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
    
    console.log('AA95 Audio Control Panel initialized');
    console.log('Hotspots are invisible - hover to see interactive areas');
  }

  // Wait for DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
