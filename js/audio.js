/**
 * Audio System for 3D Arcade Racer
 * Uses Web Audio API for 100% procedural, zero-dependency background music and sound effects.
 * No external audio files required — will never fail to load or suffer CORS issues.
 */

class SoundSystem {
    constructor() {
        this.ctx = null;
        this.initialized = false;
        this.isMuted = false;
        this.musicVolume = 0.55;
        this.sfxVolume = 0.7;

        // Master gain nodes
        this.masterGain = null;
        this.musicGain = null;
        this.sfxGain = null;

        // Music state
        this.isPlayingMusic = false;
        this.currentTrackIndex = 0;
        this.tempo = 128; // BPM
        this.stepIndex = 0;
        this.scheduleAheadTime = 0.1;
        this.nextNoteTime = 0;
        this.timerID = null;

        // Engine sound nodes
        this.engineOsc1 = null;
        this.engineOsc2 = null;
        this.engineFilter = null;
        this.engineGain = null;

        // Drift screech nodes
        this.screechGain = null;
        this.screechFilter = null;
        this.screechNoise = null;

        // Nitro whoosh nodes
        this.nitroGain = null;
        this.nitroNoise = null;
        this.nitroFilter = null;

        // Tracks definition
        this.tracks = [
            {
                name: "Neon Highway (Synthwave)",
                tempo: 128,
                // Chord progression in D minor: Dm, Bb, F, C
                chords: [
                    [50, 53, 57], // D3, F3, A3
                    [46, 50, 53], // Bb2, D3, F3
                    [41, 45, 48], // F2, A2, C3
                    [48, 52, 55]  // C3, E3, G3
                ],
                bassProgression: [38, 34, 29, 36], // D2, Bb1, F1, C2
                leadMelody: [
                    62, 0, 65, 0, 69, 67, 65, 62, 60, 62, 65, 67, 69, 72, 69, 67,
                    65, 0, 62, 0, 60, 62, 65, 60, 58, 60, 62, 65, 67, 69, 67, 65,
                    69, 72, 74, 72, 69, 67, 65, 67, 69, 65, 62, 60, 62, 65, 67, 69,
                    74, 0, 72, 0, 69, 67, 65, 62, 65, 67, 69, 72, 74, 77, 76, 74
                ]
            },
            {
                name: "Cyber Drift (Eurobeat / High-Energy)",
                tempo: 138,
                // Chords in A minor: Am, F, G, Em
                chords: [
                    [45, 48, 52], // Am
                    [41, 45, 48], // F
                    [43, 47, 50], // G
                    [40, 43, 47]  // Em
                ],
                bassProgression: [33, 29, 31, 28], // A1, F1, G1, E1
                leadMelody: [
                    69, 69, 72, 69, 76, 74, 72, 69, 71, 71, 74, 71, 74, 76, 74, 71,
                    69, 69, 72, 69, 76, 77, 76, 74, 72, 74, 76, 72, 71, 69, 67, 69,
                    76, 76, 77, 79, 77, 76, 74, 72, 74, 74, 76, 77, 76, 74, 72, 71,
                    69, 72, 76, 79, 81, 79, 76, 74, 76, 74, 72, 71, 69, 71, 72, 76
                ]
            },
            {
                name: "Turbo Overdrive (Arcade Electro)",
                tempo: 130,
                // Chords in E minor: Em, C, G, D
                chords: [
                    [40, 43, 47], // Em
                    [36, 40, 43], // C
                    [43, 47, 50], // G
                    [38, 42, 45]  // D
                ],
                bassProgression: [28, 24, 31, 26], // E1, C1, G1, D1
                leadMelody: [
                    64, 0, 67, 0, 71, 71, 69, 67, 64, 67, 71, 74, 76, 74, 71, 69,
                    67, 0, 64, 0, 62, 64, 67, 64, 62, 64, 67, 69, 71, 69, 67, 64,
                    71, 74, 76, 79, 76, 74, 71, 69, 71, 67, 64, 62, 64, 67, 71, 74,
                    76, 0, 74, 0, 71, 69, 67, 64, 67, 71, 74, 76, 79, 81, 79, 76
                ]
            }
        ];
    }

    init() {
        if (this.initialized) return;

        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();

            // Master volume
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
            this.masterGain.connect(this.ctx.destination);

            // Music bus
            this.musicGain = this.ctx.createGain();
            this.musicGain.gain.setValueAtTime(this.musicVolume, this.ctx.currentTime);
            this.musicGain.connect(this.masterGain);

            // SFX bus
            this.sfxGain = this.ctx.createGain();
            this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
            this.sfxGain.connect(this.masterGain);

            // Setup continuous procedural SFX
            this._setupEngineAudio();
            this._setupDriftScreechAudio();
            this._setupNitroAudio();

            this.initialized = true;
            console.log("Web Audio system initialized successfully.");
        } catch (e) {
            console.warn("Web Audio initialization error:", e);
        }
    }

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    /* -------------------------------------------------------------
       PROCEDURAL ENGINE SOUND (Realistic dual-oscillator synth)
    -------------------------------------------------------------- */
    _setupEngineAudio() {
        if (!this.ctx) return;

        // Sub/saw oscillator
        this.engineOsc1 = this.ctx.createOscillator();
        this.engineOsc1.type = 'sawtooth';
        this.engineOsc1.frequency.setValueAtTime(45, this.ctx.currentTime);

        // Harmonic triangle oscillator
        this.engineOsc2 = this.ctx.createOscillator();
        this.engineOsc2.type = 'triangle';
        this.engineOsc2.frequency.setValueAtTime(90, this.ctx.currentTime);

        // Lowpass filter for deep exhaust rumble
        this.engineFilter = this.ctx.createBiquadFilter();
        this.engineFilter.type = 'lowpass';
        this.engineFilter.frequency.setValueAtTime(320, this.ctx.currentTime);
        this.engineFilter.Q.setValueAtTime(3.5, this.ctx.currentTime);

        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.setValueAtTime(0.08, this.ctx.currentTime);

        this.engineOsc1.connect(this.engineFilter);
        this.engineOsc2.connect(this.engineFilter);
        this.engineFilter.connect(this.engineGain);
        this.engineGain.connect(this.sfxGain);

        this.engineOsc1.start();
        this.engineOsc2.start();
    }

    /**
     * Update engine pitch and filter based on speed, gear, and throttle
     */
    updateEngine(speed, maxSpeed, isAccelerating, gear = 1) {
        if (!this.ctx || !this.engineOsc1) return;

        const ratio = Math.max(0, Math.min(1, Math.abs(speed) / maxSpeed));
        
        // Base idle pitch around 45Hz, climbs to ~220Hz per gear
        const gearRatio = (ratio * 5) % 1; // within current gear
        const baseFreq = 50 + (ratio * 120) + (gearRatio * 90);
        const targetFreq1 = baseFreq;
        const targetFreq2 = baseFreq * 1.5;

        const now = this.ctx.currentTime;
        this.engineOsc1.frequency.setTargetAtTime(targetFreq1, now, 0.05);
        this.engineOsc2.frequency.setTargetAtTime(targetFreq2, now, 0.05);

        // Exhaust opens up with throttle
        const filterFreq = 300 + (ratio * 1600) + (isAccelerating ? 800 : 0);
        this.engineFilter.frequency.setTargetAtTime(filterFreq, now, 0.08);

        // Engine volume: subtle idle, roars under throttle
        const targetVol = isAccelerating ? (0.12 + ratio * 0.15) : (0.05 + ratio * 0.08);
        this.engineGain.gain.setTargetAtTime(targetVol, now, 0.05);
    }

    /* -------------------------------------------------------------
       DRIFT SCREECH SOUND (Bandpass noise)
    -------------------------------------------------------------- */
    _setupDriftScreechAudio() {
        if (!this.ctx) return;

        const bufferSize = this.ctx.sampleRate * 2;
        const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }

        const whiteNoise = this.ctx.createBufferSource();
        whiteNoise.buffer = noiseBuffer;
        whiteNoise.loop = true;

        this.screechFilter = this.ctx.createBiquadFilter();
        this.screechFilter.type = 'bandpass';
        this.screechFilter.frequency.setValueAtTime(2200, this.ctx.currentTime);
        this.screechFilter.Q.setValueAtTime(4.0, this.ctx.currentTime);

        this.screechGain = this.ctx.createGain();
        this.screechGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);

        whiteNoise.connect(this.screechFilter);
        this.screechFilter.connect(this.screechGain);
        this.screechGain.connect(this.sfxGain);

        whiteNoise.start();
    }

    setDriftIntensity(intensity) {
        if (!this.ctx || !this.screechGain) return;
        const val = Math.max(0, Math.min(1, intensity));
        const gainVal = val > 0.15 ? (val - 0.15) * 0.35 : 0.0001;
        this.screechGain.gain.setTargetAtTime(gainVal, this.ctx.currentTime, 0.04);
        
        // Pitch shift screech with drift speed
        const freq = 1800 + val * 1200;
        this.screechFilter.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.05);
    }

    /* -------------------------------------------------------------
       NITRO BOOST WHOOSH (Resonant swept noise)
    -------------------------------------------------------------- */
    _setupNitroAudio() {
        if (!this.ctx) return;

        const bufferSize = this.ctx.sampleRate * 2;
        const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = noiseBuffer;
        noise.loop = true;

        this.nitroFilter = this.ctx.createBiquadFilter();
        this.nitroFilter.type = 'bandpass';
        this.nitroFilter.frequency.setValueAtTime(800, this.ctx.currentTime);
        this.nitroFilter.Q.setValueAtTime(2.0, this.ctx.currentTime);

        this.nitroGain = this.ctx.createGain();
        this.nitroGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);

        noise.connect(this.nitroFilter);
        this.nitroFilter.connect(this.nitroGain);
        this.nitroGain.connect(this.sfxGain);

        noise.start();
    }

    setNitroActive(active) {
        if (!this.ctx || !this.nitroGain) return;
        const gainVal = active ? 0.35 : 0.0001;
        this.nitroGain.gain.setTargetAtTime(gainVal, this.ctx.currentTime, 0.08);

        if (active) {
            // Sweep frequency up
            this.nitroFilter.frequency.cancelScheduledValues(this.ctx.currentTime);
            this.nitroFilter.frequency.setValueAtTime(600, this.ctx.currentTime);
            this.nitroFilter.frequency.exponentialRampToValueAtTime(3200, this.ctx.currentTime + 0.6);
        }
    }

    /**
     * Instantly silence continuous engine, drift, and nitro sounds (e.g. during pause)
     */
    pauseContinuousSFX() {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        if (this.engineGain) this.engineGain.gain.setTargetAtTime(0.0001, now, 0.05);
        if (this.screechGain) this.screechGain.gain.setTargetAtTime(0.0001, now, 0.05);
        if (this.nitroGain) this.nitroGain.gain.setTargetAtTime(0.0001, now, 0.05);
    }

    /**
     * Softly duck background music during pause menu
     */
    duckMusic(isDucked) {
        if (!this.ctx || !this.musicGain || this.isMuted) return;
        const targetVol = isDucked ? (this.musicVolume * 0.35) : this.musicVolume;
        this.musicGain.gain.setTargetAtTime(targetVol, this.ctx.currentTime, 0.1);
    }

    /* -------------------------------------------------------------
       ONE-SHOT SOUND EFFECTS
    -------------------------------------------------------------- */
    playCollision(intensity = 0.5) {
        if (!this.ctx || this.isMuted) return;
        const now = this.ctx.currentTime;
        const vol = Math.min(0.6, Math.max(0.1, intensity * 0.5));

        // Metal / thud burst
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.2);

        gain.gain.setValueAtTime(vol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(now);
        osc.stop(now + 0.25);

        // Crash noise crunch
        const bufferSize = this.ctx.sampleRate * 0.15;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(vol * 0.8, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

        noise.connect(noiseGain);
        noiseGain.connect(this.sfxGain);
        noise.start(now);
    }

    playCountdownBeep(isHigh = false) {
        if (!this.ctx || this.isMuted) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(isHigh ? 880 : 440, now); // A5 vs A4

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + (isHigh ? 0.6 : 0.25));

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(now);
        osc.stop(now + (isHigh ? 0.6 : 0.25));
    }

    playLapComplete() {
        if (!this.ctx || this.isMuted) return;
        const now = this.ctx.currentTime;
        const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6 arpeggio
        notes.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now + idx * 0.08);

            gain.gain.setValueAtTime(0.25, now + idx * 0.08);
            gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.35);

            osc.connect(gain);
            gain.connect(this.sfxGain);

            osc.start(now + idx * 0.08);
            osc.stop(now + idx * 0.08 + 0.35);
        });
    }

    playFinishRace() {
        if (!this.ctx || this.isMuted) return;
        const now = this.ctx.currentTime;
        const fanfare = [
            { f: 523.25, d: 0.15 }, // C5
            { f: 523.25, d: 0.15 }, // C5
            { f: 523.25, d: 0.15 }, // C5
            { f: 659.25, d: 0.45 }, // E5
            { f: 587.33, d: 0.2 },  // D5
            { f: 659.25, d: 0.2 },  // E5
            { f: 783.99, d: 0.8 }   // G5
        ];
        let t = now;
        fanfare.forEach(item => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(item.f, t);

            gain.gain.setValueAtTime(0.3, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + item.d);

            osc.connect(gain);
            gain.connect(this.sfxGain);

            osc.start(t);
            osc.stop(t + item.d);
            t += item.d;
        });
    }

    /* -------------------------------------------------------------
       PROCEDURAL BACKGROUND MUSIC SEQUENCER
    -------------------------------------------------------------- */
    startMusic() {
        this.init();
        this.resume();
        if (this.isPlayingMusic) return;

        this.isPlayingMusic = true;
        this.stepIndex = 0;
        this.nextNoteTime = this.ctx.currentTime + 0.05;
        this._scheduler();
    }

    stopMusic() {
        this.isPlayingMusic = false;
        if (this.timerID) {
            clearTimeout(this.timerID);
            this.timerID = null;
        }
    }

    nextTrack() {
        this.currentTrackIndex = (this.currentTrackIndex + 1) % this.tracks.length;
        this.stepIndex = 0;
        return this.tracks[this.currentTrackIndex].name;
    }

    getTrackName() {
        return this.tracks[this.currentTrackIndex].name;
    }

    _midiToFreq(midi) {
        return 440 * Math.pow(2, (midi - 69) / 12);
    }

    _scheduler() {
        if (!this.isPlayingMusic || !this.ctx) return;

        while (this.nextNoteTime < this.ctx.currentTime + this.scheduleAheadTime) {
            this._scheduleStep(this.stepIndex, this.nextNoteTime);
            this._advanceStep();
        }

        this.timerID = setTimeout(() => this._scheduler(), 25);
    }

    _advanceStep() {
        const track = this.tracks[this.currentTrackIndex];
        const secondsPerBeat = 60.0 / track.tempo;
        const secondsPer16th = secondsPerBeat / 4; // 16th note steps
        this.nextNoteTime += secondsPer16th;
        this.stepIndex = (this.stepIndex + 1) % 64; // 4-bar loop (64 steps)
    }

    _scheduleStep(step, time) {
        if (this.isMuted) return;
        const track = this.tracks[this.currentTrackIndex];
        const bar = Math.floor(step / 16);
        const beat = Math.floor((step % 16) / 4);
        const stepInBeat = step % 4;

        // 1. KICK DRUM: on beats 1, 2, 3, 4 (4-on-the-floor EDM / arcade feel)
        if (stepInBeat === 0) {
            this._playSynthKick(time);
        }

        // 2. SNARE / CLAP: on beats 2 and 4 (standard backbeat)
        if (beat === 1 && stepInBeat === 0 || beat === 3 && stepInBeat === 0) {
            this._playSynthSnare(time);
        }

        // 3. HI-HAT: 16th-note drive with open hat on offbeats
        const isOpen = (step % 4 === 2);
        this._playSynthHiHat(time, isOpen);

        // 4. CRASH CYMBAL on the first beat of bar 0
        if (step === 0) {
            this._playSynthCrash(time);
        }

        // 5. ROLLING BASSLINE: 16th-note driving synth bass
        const bassRoot = track.bassProgression[bar % track.bassProgression.length];
        // Octave bounce pattern
        const bassMidi = (step % 2 === 0) ? bassRoot : (bassRoot + 12);
        this._playSynthBass(bassMidi, time, 0.12);

        // 6. CHORD PADS: sustained lush synth on beat 1 of each bar
        if (step % 16 === 0) {
            const chord = track.chords[bar % track.chords.length];
            this._playSynthPad(chord, time, 1.8);
        }

        // 7. ARPEGGIO: sparkling 16th note synth arpeggios
        const chord = track.chords[bar % track.chords.length];
        const arpNote = chord[step % chord.length] + 12; // 1 octave above chord
        this._playSynthArp(arpNote, time, 0.08);

        // 8. LEAD MELODY: catchy arcade hook
        const melodyNote = track.leadMelody[step % track.leadMelody.length];
        if (melodyNote > 0) {
            this._playSynthLead(melodyNote, time, 0.22);
        }
    }

    /* Drum synthesizers */
    _playSynthKick(time) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(160, time);
        osc.frequency.exponentialRampToValueAtTime(35, time + 0.12);

        gain.gain.setValueAtTime(0.7, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.22);

        osc.connect(gain);
        gain.connect(this.musicGain);

        osc.start(time);
        osc.stop(time + 0.25);
    }

    _playSynthSnare(time) {
        // Noise burst
        const bufferSize = this.ctx.sampleRate * 0.12;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1400, time);
        filter.Q.setValueAtTime(1.5, time);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.35, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.musicGain);

        noise.start(time);

        // Body tone
        const osc = this.ctx.createOscillator();
        const oscGain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(200, time);
        osc.frequency.exponentialRampToValueAtTime(80, time + 0.08);

        oscGain.gain.setValueAtTime(0.3, time);
        oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.09);

        osc.connect(oscGain);
        oscGain.connect(this.musicGain);

        osc.start(time);
        osc.stop(time + 0.1);
    }

    _playSynthHiHat(time, isOpen) {
        const bufferSize = this.ctx.sampleRate * (isOpen ? 0.2 : 0.04);
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(7000, time);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(isOpen ? 0.18 : 0.1, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + (isOpen ? 0.18 : 0.04));

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.musicGain);

        noise.start(time);
    }

    _playSynthCrash(time) {
        const bufferSize = this.ctx.sampleRate * 0.8;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.35));
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(4500, time);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.28, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.8);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.musicGain);

        noise.start(time);
    }

    /* Melodic & Harmonic synthesizers */
    _playSynthBass(midi, time, duration) {
        const freq = this._midiToFreq(midi);
        const osc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, time);

        // Filter envelope for snappy synth bass
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(900, time);
        filter.frequency.exponentialRampToValueAtTime(150, time + duration);
        filter.Q.setValueAtTime(4.0, time);

        gain.gain.setValueAtTime(0.38, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.musicGain);

        osc.start(time);
        osc.stop(time + duration);
    }

    _playSynthPad(chordMidis, time, duration) {
        chordMidis.forEach((midi, idx) => {
            const freq = this._midiToFreq(midi);
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const filter = this.ctx.createBiquadFilter();

            osc.type = (idx % 2 === 0) ? 'sawtooth' : 'triangle';
            osc.frequency.setValueAtTime(freq, time);

            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(800, time);

            gain.gain.setValueAtTime(0.001, time);
            gain.gain.linearRampToValueAtTime(0.08, time + 0.2);
            gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.musicGain);

            osc.start(time);
            osc.stop(time + duration);
        });
    }

    _playSynthArp(midi, time, duration) {
        const freq = this._midiToFreq(midi);
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, time);

        gain.gain.setValueAtTime(0.09, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

        osc.connect(gain);
        gain.connect(this.musicGain);

        osc.start(time);
        osc.stop(time + duration);
    }

    _playSynthLead(midi, time, duration) {
        const freq = this._midiToFreq(midi);
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();

        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(freq, time);

        // Detuned second oscillator for fat chorus lead
        osc2.type = 'square';
        osc2.frequency.setValueAtTime(freq * 1.004, time);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2400, time);
        filter.Q.setValueAtTime(2.5, time);

        gain.gain.setValueAtTime(0.18, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(gain);
        gain.connect(this.musicGain);

        osc1.start(time);
        osc2.start(time);
        osc1.stop(time + duration);
        osc2.stop(time + duration);
    }

    /* Master controls */
    setMusicVolume(vol) {
        this.musicVolume = Math.max(0, Math.min(1, vol));
        if (this.musicGain && this.ctx) {
            this.musicGain.gain.setValueAtTime(this.musicVolume, this.ctx.currentTime);
        }
    }

    setSfxVolume(vol) {
        this.sfxVolume = Math.max(0, Math.min(1, vol));
        if (this.sfxGain && this.ctx) {
            this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
        }
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        if (this.masterGain && this.ctx) {
            this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 1.0, this.ctx.currentTime);
        }
        return this.isMuted;
    }
}

// Global sound system instance
window.soundSystem = new SoundSystem();

