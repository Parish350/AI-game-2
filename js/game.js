/**
 * Main Game Engine for 3D Arcade Racer
 * Manages Three.js rendering, player input, CPU AI, collisions, race logic, HUD, minimap, and cameras.
 */

class Game {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.track = null;

        // Racers
        this.player = null;
        this.cpuRacers = [];
        this.allCars = [];

        // Game State
        this.state = 'MENU'; // 'MENU', 'COUNTDOWN', 'RACING', 'PAUSED', 'FINISHED'
        this.totalLaps = 1; // 1 Turn = 1 Lap
        this.countdownValue = 3;
        this.raceStartTime = 0;
        this.raceTime = 0;

        // Camera Modes: 0 = Chase, 1 = Close Chase, 2 = Cockpit/Hood, 3 = Helicopter
        this.cameraMode = 0;
        this.cameraOffset = new THREE.Vector3(0, 4.5, -9.5);
        this.cameraLookOffset = new THREE.Vector3(0, 1.2, 5.0);

        // Player Input
        this.input = {
            forward: false,
            reverse: false,
            left: false,
            right: false,
            handbrake: false,
            nitro: false
        };

        // Minimap
        this.minimapCanvas = null;
        this.minimapCtx = null;

        // Time tracking
        this.clock = new THREE.Clock();
        this.lastTime = performance.now();

        // UI element references
        this.ui = {};

        this._initThree();
        this._initTrack();
        this._initCars();
        this._initInput();
        this._initUI();
        this._initMinimap();

        window.addEventListener('resize', () => this._onResize());

        // Kick off main render loop
        this._animate();
    }

    _initThree() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0b111e); // Cyber twilight
        this.scene.fog = new THREE.FogExp2(0x0b111e, 0.0012);

        this.camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 3000);
        this.camera.position.set(0, 15, -25);

        this.renderer = new THREE.WebGLRenderer({
            canvas: document.getElementById('game-canvas'),
            antialias: true,
            powerPreference: 'high-performance'
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // Lighting
        const hemiLight = new THREE.HemisphereLight(0x89c4ff, 0x1a2636, 0.7);
        hemiLight.position.set(0, 50, 0);
        this.scene.add(hemiLight);

        const dirLight = new THREE.DirectionalLight(0xfff5e6, 1.2);
        dirLight.position.set(150, 250, 100);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;
        dirLight.shadow.camera.near = 10;
        dirLight.shadow.camera.far = 600;
        const d = 140;
        dirLight.shadow.camera.left = -d;
        dirLight.shadow.camera.right = d;
        dirLight.shadow.camera.top = d;
        dirLight.shadow.camera.bottom = -d;
        dirLight.shadow.bias = -0.0005;
        this.scene.add(dirLight);

        // Ambient cyber glow light
        const cyberLight = new THREE.AmbientLight(0x00e5ff, 0.2);
        this.scene.add(cyberLight);
    }

    _initTrack() {
        this.track = new RaceTrack(this.scene);
    }

    _initCars() {
        // 1. PLAYER CAR (Cyan Hypercar)
        this.player = new Car(this.scene, {
            name: 'YOU (Player)',
            isPlayer: true,
            color: 0x00e5ff,       // Neon Cyan
            accentColor: 0xff0055, // Hot Pink
            number: 1,
            maxSpeed: 74,
            acceleration: 40
        });

        // 2. CPU RACERS (5 Opponents with distinct colors & stats)
        const cpuConfigs = [
            {
                name: 'Viper',
                color: 0xff1744,        // Crimson Red
                accentColor: 0xffea00,  // Gold
                number: 7,
                maxSpeed: 73,
                acceleration: 39,
                skill: 0.92,
                aggression: 0.85,
                preferredLaneOffset: -4.0
            },
            {
                name: 'Shadow',
                color: 0x263238,        // Stealth Charcoal / Matte Black
                accentColor: 0xffd700,  // Metallic Gold
                number: 13,
                maxSpeed: 72,
                acceleration: 38,
                skill: 0.95,
                aggression: 0.65,
                preferredLaneOffset: 3.5
            },
            {
                name: 'Blaze',
                color: 0xff6d00,        // Flame Orange
                accentColor: 0xffffff,  // White
                number: 24,
                maxSpeed: 71,
                acceleration: 41,
                skill: 0.88,
                aggression: 0.80,
                preferredLaneOffset: -1.5
            },
            {
                name: 'Apex',
                color: 0x00e676,        // Acid Green
                accentColor: 0x000000,  // Black
                number: 88,
                maxSpeed: 72.5,
                acceleration: 38.5,
                skill: 0.90,
                aggression: 0.70,
                preferredLaneOffset: 2.0
            },
            {
                name: 'Thunder',
                color: 0xd500f9,        // Royal Purple
                accentColor: 0x00e5ff,  // Electric Blue
                number: 99,
                maxSpeed: 73.5,
                acceleration: 37.5,
                skill: 0.86,
                aggression: 0.75,
                preferredLaneOffset: -5.0
            }
        ];

        this.cpuRacers = [];
        cpuConfigs.forEach(cfg => {
            const car = new Car(this.scene, {
                name: cfg.name,
                isPlayer: false,
                color: cfg.color,
                accentColor: cfg.accentColor,
                number: cfg.number,
                maxSpeed: cfg.maxSpeed,
                acceleration: cfg.acceleration
            });

            const controller = new AICarController(car, this.track, {
                name: cfg.name,
                skill: cfg.skill,
                aggression: cfg.aggression,
                preferredLaneOffset: cfg.preferredLaneOffset
            });

            this.cpuRacers.push(controller);
        });

        this.allCars = [this.player, ...this.cpuRacers.map(c => c.car)];
        this._setupStartingGrid();
    }

    _setupStartingGrid() {
        // Place cars in staggered 2x3 grid behind start/finish line
        // Start line is at t = 0 (z = 0 heading in +z direction)
        const gridPositions = [
            { lateral: -4.5, distBack: -10 }, // Slot 1: Player (Front Row Left)
            { lateral:  4.5, distBack: -10 }, // Slot 2: Viper  (Front Row Right)
            { lateral: -4.5, distBack: -26 }, // Slot 3: Shadow (Row 2 Left)
            { lateral:  4.5, distBack: -26 }, // Slot 4: Blaze  (Row 2 Right)
            { lateral: -4.5, distBack: -42 }, // Slot 5: Apex   (Row 3 Left)
            { lateral:  4.5, distBack: -42 }  // Slot 6: Thunder(Row 3 Right)
        ];

        this.allCars.forEach((car, idx) => {
            const slot = gridPositions[idx];
            // Position on home straightaway (facing +Z)
            const pos = new THREE.Vector3(slot.lateral, 0.1, slot.distBack);
            car.setGridPosition(pos, 0); // heading = 0 (pointing forward along +z)
            car.currentLap = 1;
            car.trackProgress = 0.98;
            car.hasStartedFirstLap = false;
            car.hasPassedHalfway = false;
            car.raceDistance = slot.distBack;
            car.hasFinished = false;
            car.lastLapTime = 0;
            car.bestLapTime = 0;
            car.totalRaceTime = 0;
        });
    }

    _initInput() {
        const keyMap = {
            'KeyW': 'forward', 'ArrowUp': 'forward',
            'KeyS': 'reverse', 'ArrowDown': 'reverse',
            'KeyA': 'left',    'ArrowLeft': 'left',
            'KeyD': 'right',   'ArrowRight': 'right',
            'Space': 'handbrake',
            'ShiftLeft': 'nitro', 'ShiftRight': 'nitro'
        };

        window.addEventListener('keydown', (e) => {
            if (keyMap[e.code]) {
                this.input[keyMap[e.code]] = true;
                e.preventDefault();
            }

            if (e.code === 'KeyC') {
                this.cycleCamera();
            } else if (e.code === 'KeyR') {
                this.resetPlayerToTrack();
            } else if (e.code === 'KeyP' || e.code === 'Escape') {
                this.togglePause();
            } else if (e.code === 'KeyM') {
                window.soundSystem.toggleMute();
                this._updateMuteUI();
            }

            // Resume audio context on any keypress
            if (window.soundSystem) window.soundSystem.resume();
        });

        window.addEventListener('keyup', (e) => {
            if (keyMap[e.code]) {
                this.input[keyMap[e.code]] = false;
                e.preventDefault();
            }
        });

        // Touch control event listeners
        this._setupTouchControls();
    }

    _setupTouchControls() {
        const bindTouchBtn = (id, action) => {
            const btn = document.getElementById(id);
            if (!btn) return;
            const start = (e) => { e.preventDefault(); this.input[action] = true; };
            const end = (e) => { e.preventDefault(); this.input[action] = false; };
            btn.addEventListener('touchstart', start, { passive: false });
            btn.addEventListener('touchend', end, { passive: false });
            btn.addEventListener('mousedown', start);
            btn.addEventListener('mouseup', end);
            btn.addEventListener('mouseleave', end);
        };

        bindTouchBtn('btn-gas', 'forward');
        bindTouchBtn('btn-brake', 'reverse');
        bindTouchBtn('btn-left', 'left');
        bindTouchBtn('btn-right', 'right');
        bindTouchBtn('btn-drift', 'handbrake');
        bindTouchBtn('btn-nitro', 'nitro');

        const touchPause = document.getElementById('btn-touch-pause');
        if (touchPause) {
            touchPause.addEventListener('click', (e) => {
                e.preventDefault();
                this.togglePause();
            });
        }
    }

    _initUI() {
        this.ui = {
            speed: document.getElementById('hud-speed'),
            gear: document.getElementById('hud-gear'),
            rpmBar: document.getElementById('hud-rpm-fill'),
            position: document.getElementById('hud-pos'),
            lap: document.getElementById('hud-lap'),
            time: document.getElementById('hud-time'),
            nitroFill: document.getElementById('hud-nitro-fill'),
            driftScore: document.getElementById('hud-drift-score'),
            countdownOverlay: document.getElementById('countdown-overlay'),
            countdownNum: document.getElementById('countdown-num'),
            banner: document.getElementById('hud-banner'),
            startModal: document.getElementById('start-modal'),
            finishModal: document.getElementById('finish-modal'),
            leaderboardBody: document.getElementById('leaderboard-body'),
            trackName: document.getElementById('track-title'),
            muteBtn: document.getElementById('btn-mute'),
            playPauseBtn: document.getElementById('btn-play-pause'),
            musicVolSlider: document.getElementById('slider-music'),
            sfxVolSlider: document.getElementById('slider-sfx'),

            // Pause Modal UI references
            pauseBtn: document.getElementById('btn-pause'),
            pauseModal: document.getElementById('pause-modal'),
            pauseStatPos: document.getElementById('pause-stat-pos'),
            pauseStatLap: document.getElementById('pause-stat-lap'),
            pauseStatTime: document.getElementById('pause-stat-time'),
            pauseResumeBtn: document.getElementById('btn-resume-race'),
            pauseRestartBtn: document.getElementById('btn-pause-restart'),
            pauseMainMenuBtn: document.getElementById('btn-pause-main-menu'),
            pauseSliderMusic: document.getElementById('pause-slider-music'),
            pauseSliderSfx: document.getElementById('pause-slider-sfx'),
            pauseMuteBtn: document.getElementById('pause-btn-mute')
        };

        // Button handlers
        const startBtn = document.getElementById('btn-start-race');
        if (startBtn) {
            startBtn.addEventListener('click', () => this.startRace());
        }

        // Lap Selector Buttons in Start Modal
        const lapBtns = document.querySelectorAll('.lap-opt-btn');
        lapBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                lapBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.totalLaps = parseInt(btn.getAttribute('data-laps'), 10) || 3;
                if (this.ui.lap) {
                    this.ui.lap.textContent = `LAP 1 / ${this.totalLaps}`;
                }
            });
        });

        const restartBtn = document.getElementById('btn-race-again');
        if (restartBtn) {
            restartBtn.addEventListener('click', () => this.restartGame());
        }

        const camBtn = document.getElementById('btn-cam-switch');
        if (camBtn) {
            camBtn.addEventListener('click', () => this.cycleCamera());
        }

        const resetBtn = document.getElementById('btn-car-reset');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.resetPlayerToTrack());
        }

        // Pause Menu Handlers
        if (this.ui.pauseBtn) {
            this.ui.pauseBtn.addEventListener('click', () => this.togglePause());
        }

        if (this.ui.pauseResumeBtn) {
            this.ui.pauseResumeBtn.addEventListener('click', () => this.resumeGame());
        }

        if (this.ui.pauseRestartBtn) {
            this.ui.pauseRestartBtn.addEventListener('click', () => {
                if (this.ui.pauseModal) this.ui.pauseModal.style.display = 'none';
                if (window.soundSystem) {
                    window.soundSystem.pauseContinuousSFX();
                    window.soundSystem.duckMusic(false);
                }
                this.restartGame();
            });
        }

        if (this.ui.pauseMainMenuBtn) {
            this.ui.pauseMainMenuBtn.addEventListener('click', () => this.quitToMainMenu());
        }

        if (this.ui.pauseSliderMusic) {
            this.ui.pauseSliderMusic.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                window.soundSystem.setMusicVolume(val);
                if (this.ui.musicVolSlider) this.ui.musicVolSlider.value = val;
            });
        }

        if (this.ui.pauseSliderSfx) {
            this.ui.pauseSliderSfx.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                window.soundSystem.setSfxVolume(val);
                if (this.ui.sfxVolSlider) this.ui.sfxVolSlider.value = val;
            });
        }

        if (this.ui.pauseMuteBtn) {
            this.ui.pauseMuteBtn.addEventListener('click', () => {
                window.soundSystem.toggleMute();
                this._updateMuteUI();
            });
        }

        // Audio UI Handlers
        if (this.ui.muteBtn) {
            this.ui.muteBtn.addEventListener('click', () => {
                window.soundSystem.toggleMute();
                this._updateMuteUI();
            });
        }

        if (this.ui.playPauseBtn) {
            this.ui.playPauseBtn.addEventListener('click', () => {
                if (window.soundSystem.isPlayingMusic) {
                    window.soundSystem.stopMusic();
                    this.ui.playPauseBtn.textContent = '▶';
                } else {
                    window.soundSystem.startMusic();
                    this.ui.playPauseBtn.textContent = '⏸';
                }
            });
        }

        const nextTrackBtn = document.getElementById('btn-next-track');
        if (nextTrackBtn) {
            nextTrackBtn.addEventListener('click', () => {
                const name = window.soundSystem.nextTrack();
                if (this.ui.trackName) this.ui.trackName.textContent = name;
            });
        }

        if (this.ui.musicVolSlider) {
            this.ui.musicVolSlider.addEventListener('input', (e) => {
                window.soundSystem.setMusicVolume(parseFloat(e.target.value));
            });
        }

        if (this.ui.sfxVolSlider) {
            this.ui.sfxVolSlider.addEventListener('input', (e) => {
                window.soundSystem.setSfxVolume(parseFloat(e.target.value));
            });
        }
    }

    _updateMuteUI() {
        const isMuted = window.soundSystem ? window.soundSystem.isMuted : false;
        if (this.ui.muteBtn) {
            this.ui.muteBtn.textContent = isMuted ? '🔇' : '🔊';
        }
        if (this.ui.pauseMuteBtn) {
            this.ui.pauseMuteBtn.textContent = isMuted ? '🔇 UNMUTE' : '🔊 MUTE';
        }
    }

    _initMinimap() {
        this.minimapCanvas = document.getElementById('minimap-canvas');
        if (!this.minimapCanvas) return;
        this.minimapCtx = this.minimapCanvas.getContext('2d');
    }

    startRace() {
        // Start background music
        if (window.soundSystem) {
            window.soundSystem.startMusic();
            if (this.ui.trackName) {
                this.ui.trackName.textContent = window.soundSystem.getTrackName();
            }
        }

        // Hide start and pause modals
        if (this.ui.startModal) {
            this.ui.startModal.style.display = 'none';
        }
        if (this.ui.pauseModal) {
            this.ui.pauseModal.style.display = 'none';
        }

        this._setupStartingGrid();
        this.state = 'COUNTDOWN';
        this.countdownValue = 3;

        if (this.ui.countdownOverlay) {
            this.ui.countdownOverlay.style.display = 'flex';
            this.ui.countdownNum.textContent = '3';
        }

        if (window.soundSystem) window.soundSystem.playCountdownBeep(false);

        // Countdown timer: 3... 2... 1... GO!
        const countInterval = setInterval(() => {
            this.countdownValue--;
            if (this.countdownValue > 0) {
                if (this.ui.countdownNum) this.ui.countdownNum.textContent = this.countdownValue;
                if (window.soundSystem) window.soundSystem.playCountdownBeep(false);
            } else if (this.countdownValue === 0) {
                if (this.ui.countdownNum) {
                    this.ui.countdownNum.textContent = 'GO!';
                    this.ui.countdownNum.style.color = '#76ff03';
                }
                if (window.soundSystem) window.soundSystem.playCountdownBeep(true);
                this.state = 'RACING';
                this.raceStartTime = performance.now();
                this.player.lapStartTime = this.raceStartTime;
            } else {
                clearInterval(countInterval);
                if (this.ui.countdownOverlay) {
                    this.ui.countdownOverlay.style.display = 'none';
                }
            }
        }, 1000);
    }

    restartGame() {
        if (this.ui.finishModal) {
            this.ui.finishModal.style.display = 'none';
        }
        if (this.ui.pauseModal) {
            this.ui.pauseModal.style.display = 'none';
        }
        this.startRace();
    }

    cycleCamera() {
        this.cameraMode = (this.cameraMode + 1) % 4;
        const modes = ['CHASE', 'CLOSE CHASE', 'HOOD / COCKPIT', 'HELICOPTER'];
        this.showBanner(`CAMERA: ${modes[this.cameraMode]}`);
    }

    resetPlayerToTrack() {
        const info = this.track.findClosestTrackPoint(this.player.position);
        this.player.position.copy(info.point);
        this.player.position.y += 0.2;
        this.player.heading = Math.atan2(info.tangent.x, info.tangent.z);
        this.player.speed = 0;
        this.player.velocity.set(0, 0, 0);
        this.showBanner('CAR RESET TO TRACK');
    }

    pauseGame() {
        if (this.state !== 'RACING') return;
        this.state = 'PAUSED';
        this.pauseStartTime = performance.now();

        // Silence engine / drift / nitro SFX and duck music
        if (window.soundSystem) {
            window.soundSystem.pauseContinuousSFX();
            window.soundSystem.duckMusic(true);
        }

        this._updatePauseModalStats();

        // Sync slider values in pause modal
        if (this.ui.pauseSliderMusic && window.soundSystem) {
            this.ui.pauseSliderMusic.value = window.soundSystem.musicVolume;
        }
        if (this.ui.pauseSliderSfx && window.soundSystem) {
            this.ui.pauseSliderSfx.value = window.soundSystem.sfxVolume;
        }

        if (this.ui.pauseModal) {
            this.ui.pauseModal.style.display = 'flex';
        }
    }

    resumeGame() {
        if (this.state !== 'PAUSED') return;

        // Compensate race and lap start times by the time spent paused
        const pausedDuration = performance.now() - (this.pauseStartTime || performance.now());
        this.raceStartTime += pausedDuration;
        if (this.player) this.player.lapStartTime += pausedDuration;
        this.cpuRacers.forEach(controller => {
            if (controller.car) controller.car.lapStartTime += pausedDuration;
        });

        if (window.soundSystem) {
            window.soundSystem.duckMusic(false);
        }

        if (this.ui.pauseModal) {
            this.ui.pauseModal.style.display = 'none';
        }

        this.state = 'RACING';
        this.showBanner('RACE RESUMED', 1000);
    }

    togglePause() {
        if (this.state === 'RACING') {
            this.pauseGame();
        } else if (this.state === 'PAUSED') {
            this.resumeGame();
        }
    }

    quitToMainMenu() {
        if (this.ui.pauseModal) this.ui.pauseModal.style.display = 'none';
        if (this.ui.finishModal) this.ui.finishModal.style.display = 'none';
        if (this.ui.countdownOverlay) this.ui.countdownOverlay.style.display = 'none';

        if (window.soundSystem) {
            window.soundSystem.pauseContinuousSFX();
            window.soundSystem.duckMusic(false);
        }

        this.state = 'MENU';
        this._setupStartingGrid();
        if (this.ui.startModal) {
            this.ui.startModal.style.display = 'flex';
        }
    }

    _updatePauseModalStats() {
        if (this.player) {
            const suffix = ['TH', 'ST', 'ND', 'RD', 'TH', 'TH', 'TH'][this.player.rank] || 'TH';
            if (this.ui.pauseStatPos) {
                this.ui.pauseStatPos.textContent = `${this.player.rank}${suffix} / 6`;
            }
            if (this.ui.pauseStatLap) {
                const displayLap = Math.min(this.totalLaps, this.player.currentLap);
                this.ui.pauseStatLap.textContent = `${displayLap} / ${this.totalLaps}`;
            }
        }
        if (this.ui.pauseStatTime) {
            this.ui.pauseStatTime.textContent = this._formatTime(this.raceTime);
        }
    }

    showBanner(text, duration = 2000) {
        if (!this.ui.banner) return;
        this.ui.banner.textContent = text;
        this.ui.banner.style.opacity = text ? '1' : '0';
        if (text && duration > 0) {
            setTimeout(() => {
                if (this.ui.banner.textContent === text) {
                    this.ui.banner.style.opacity = '0';
                }
            }, duration);
        }
    }

    _animate() {
        requestAnimationFrame(() => this._animate());

        const now = performance.now();
        let dt = (now - this.lastTime) / 1000;
        this.lastTime = now;
        if (dt > 0.1) dt = 0.016;

        if (this.state === 'RACING') {
            this.raceTime = (now - this.raceStartTime) / 1000;

            // 1. Update Player Car
            this.player.update(dt, this.input, this.track);

            // 2. Update CPU Cars with AI
            this.cpuRacers.forEach(controller => {
                controller.update(dt, this.allCars);
            });

            // 3. Car-to-Car Collision Check
            this._handleCarCollisions();

            // 4. Lap & Checkpoint Tracker
            this._updateRaceProgress(now);

            // 5. Update HUD Displays
            this._updateHUD();

            // 6. Render Minimap Radar
            this._drawMinimap();
        }

        // Camera follow
        this._updateCamera(dt);

        // Render Three.js Scene
        this.renderer.render(this.scene, this.camera);
    }

    _handleCarCollisions() {
        const cars = this.allCars;
        const count = cars.length;
        const collisionRadius = 2.6;

        for (let i = 0; i < count; i++) {
            for (let j = i + 1; j < count; j++) {
                const c1 = cars[i];
                const c2 = cars[j];

                const dx = c2.position.x - c1.position.x;
                const dz = c2.position.z - c1.position.z;
                const dist = Math.hypot(dx, dz);

                if (dist < collisionRadius && dist > 0.001) {
                    // Overlap penetration
                    const overlap = (collisionRadius - dist);
                    const nx = dx / dist;
                    const nz = dz / dist;

                    // Push cars apart
                    c1.position.x -= nx * overlap * 0.5;
                    c1.position.z -= nz * overlap * 0.5;
                    c2.position.x += nx * overlap * 0.5;
                    c2.position.z += nz * overlap * 0.5;

                    // Elastic recoil
                    const relativeSpeed = Math.abs(c1.speed - c2.speed) + 10;
                    c1.applyImpulse(new THREE.Vector3(-nx, 0, -nz), relativeSpeed);
                    c2.applyImpulse(new THREE.Vector3(nx, 0, nz), relativeSpeed);
                }
            }
        }
    }

    _updateRaceProgress(now) {
        this.allCars.forEach(car => {
            const trackInfo = this.track.findClosestTrackPoint(car.position);
            const prevT = car.trackProgress || 0;
            const currentT = trackInfo.t;

            // Track halfway progression around the circuit (back half of track):
            if (currentT >= 0.35 && currentT <= 0.75) {
                car.hasPassedHalfway = true;
            }

            // Case A: Initial Start Line Crossing from the starting grid (z < 0 to z >= 0)
            if (!car.hasStartedFirstLap) {
                if ((currentT >= 0.0 && currentT <= 0.20 && car.position.z >= -0.5) || (prevT > 0.85 && currentT < 0.20)) {
                    car.hasStartedFirstLap = true;
                    car.lapStartTime = now;
                    car.hasPassedHalfway = false;
                }
            } else {
                // Case B: Finish Line Crossing after completing 1 turn around the track
                // Detect crossing start/finish line (wrap around from >0.75 to <0.25)
                if (prevT > 0.75 && currentT < 0.25) {
                    if (car.hasPassedHalfway) {
                        const lapTime = (now - car.lapStartTime) / 1000;
                        car.lastLapTime = lapTime;
                        const isNewBest = (!car.bestLapTime || lapTime < car.bestLapTime);
                        if (isNewBest) {
                            car.bestLapTime = lapTime;
                        }

                        // Reset halfway marker and timer for next turn/lap
                        car.hasPassedHalfway = false;
                        car.lapStartTime = now;

                        // Check if race completes or advances
                        if (car.currentLap < this.totalLaps) {
                            car.currentLap++;

                            if (car.isPlayer) {
                                if (window.soundSystem) window.soundSystem.playLapComplete();
                                const timeStr = this._formatTime(lapTime);
                                const bestTag = isNewBest ? ' ⚡ NEW BEST!' : '';

                                if (car.currentLap === this.totalLaps) {
                                    this.showBanner(`🔥 FINAL TURN! (Turn ${car.currentLap - 1}: ${timeStr}${bestTag})`, 3500);
                                } else {
                                    this.showBanner(`TURN ${car.currentLap} / ${this.totalLaps} (${timeStr}${bestTag})`, 3000);
                                }
                            }
                        } else {
                            // Completed 1 Turn = 1 Lap!
                            car.currentLap = this.totalLaps + 1;
                            car.hasFinished = true;
                            car.totalRaceTime = (now - this.raceStartTime) / 1000;

                            if (car.isPlayer) {
                                this._finishRace();
                            }
                        }
                    }
                }
            }

            car.trackProgress = currentT;

            // Accurate continuous race distance for rankings:
            const lapNumberForDistance = car.hasStartedFirstLap ? Math.max(1, car.currentLap) : 1;
            const lapOffset = (lapNumberForDistance - 1) * this.track.trackLength;
            if (car.hasStartedFirstLap) {
                car.raceDistance = lapOffset + trackInfo.distanceAlongTrack;
            } else {
                car.raceDistance = car.position.z; // negative starting distance on grid
            }
        });

        // Compute rankings
        const sorted = [...this.allCars].sort((a, b) => b.raceDistance - a.raceDistance);
        sorted.forEach((car, rank) => {
            car.rank = rank + 1;
        });
    }

    _finishRace() {
        this.state = 'FINISHED';
        if (window.soundSystem) window.soundSystem.playFinishRace();

        if (this.player && this.player.rank === 1) {
            this.showBanner('🏆 1 TURN COMPLETE! 1ST PLACE WINNER! 🏁', 4500);
        } else {
            const playerRank = this.player ? this.player.rank : 1;
            const suffix = ['TH', 'ST', 'ND', 'RD', 'TH', 'TH', 'TH'][playerRank] || 'TH';
            this.showBanner(`🏁 1 TURN COMPLETE! ${playerRank}${suffix} PLACE 🏁`, 4500);
        }

        // Sort final results
        const sorted = [...this.allCars].sort((a, b) => b.raceDistance - a.raceDistance);

        if (this.ui.leaderboardBody) {
            let html = '';
            sorted.forEach((car, idx) => {
                const isUser = car.isPlayer;
                const posClass = idx === 0 ? 'pos-gold' : (idx === 1 ? 'pos-silver' : (idx === 2 ? 'pos-bronze' : ''));
                const bestStr = car.bestLapTime ? this._formatTime(car.bestLapTime) : '--:--.--';
                const totalStr = car.totalRaceTime ? this._formatTime(car.totalRaceTime) : this._formatTime(this.raceTime);
                html += `
                    <tr class="${isUser ? 'user-row' : ''}">
                        <td class="${posClass}">#${idx + 1}</td>
                        <td style="color: #${car.color.toString(16).padStart(6, '0')}; font-weight: bold;">
                            ${car.name}
                        </td>
                        <td>${car.number}</td>
                        <td>${bestStr}</td>
                        <td>${totalStr}</td>
                    </tr>
                `;
            });
            this.ui.leaderboardBody.innerHTML = html;
        }

        setTimeout(() => {
            if (this.ui.finishModal) {
                this.ui.finishModal.style.display = 'flex';
            }
        }, 1500);
    }

    _updateCamera(dt) {
        const player = this.player;
        if (!player) return;

        const forwardX = Math.sin(player.heading);
        const forwardZ = Math.cos(player.heading);

        let targetPos = new THREE.Vector3();
        let targetLook = new THREE.Vector3();

        if (this.cameraMode === 0) {
            // Standard Chase Cam
            const nitroZoom = player.isNitroActive ? -2.2 : 0;
            const dist = -9.0 + nitroZoom;
            const height = 4.2;

            targetPos.set(
                player.position.x + forwardX * dist,
                player.position.y + height,
                player.position.z + forwardZ * dist
            );

            targetLook.set(
                player.position.x + forwardX * 6,
                player.position.y + 1.2,
                player.position.z + forwardZ * 6
            );

            // Dynamic camera FOV widen on nitro
            const targetFov = player.isNitroActive ? 76 : 65;
            this.camera.fov += (targetFov - this.camera.fov) * 5 * dt;
            this.camera.updateProjectionMatrix();

        } else if (this.cameraMode === 1) {
            // Close Arcade Bumper Cam
            targetPos.set(
                player.position.x - forwardX * 5.5,
                player.position.y + 2.4,
                player.position.z - forwardZ * 5.5
            );
            targetLook.set(
                player.position.x + forwardX * 8,
                player.position.y + 0.8,
                player.position.z + forwardZ * 8
            );

        } else if (this.cameraMode === 2) {
            // Hood / Cockpit Cam
            targetPos.set(
                player.position.x + forwardX * 0.8,
                player.position.y + 1.2,
                player.position.z + forwardZ * 0.8
            );
            targetLook.set(
                player.position.x + forwardX * 25,
                player.position.y + 1.0,
                player.position.z + forwardZ * 25
            );

        } else if (this.cameraMode === 3) {
            // Helicopter / Aerial Cam
            targetPos.set(
                player.position.x - forwardX * 16,
                player.position.y + 24,
                player.position.z - forwardZ * 16
            );
            targetLook.copy(player.position);
        }

        // Smooth camera lerp
        const lerpFactor = this.cameraMode === 2 ? 0.4 : 0.12;
        this.camera.position.lerp(targetPos, lerpFactor);
        
        // Look at target point
        const curLook = new THREE.Vector3();
        this.camera.getWorldDirection(curLook);
        const wantedDir = targetLook.clone().sub(this.camera.position).normalize();
        curLook.lerp(wantedDir, 0.18);
        this.camera.lookAt(this.camera.position.clone().add(curLook));
    }

    _updateHUD() {
        const p = this.player;
        if (!p) return;

        const speedKmh = Math.floor(Math.abs(p.speed) * 3.6);
        if (this.ui.speed) this.ui.speed.textContent = speedKmh;
        if (this.ui.gear) this.ui.gear.textContent = p.gear;

        // RPM gauge fill (0 to 100%)
        if (this.ui.rpmBar) {
            const rpmPercent = Math.min(100, Math.max(0, (p.rpm - 1000) / 7000 * 100));
            this.ui.rpmBar.style.width = `${rpmPercent}%`;
            if (rpmPercent > 85) {
                this.ui.rpmBar.style.background = '#ff0055'; // Redline
            } else {
                this.ui.rpmBar.style.background = '#00e5ff';
            }
        }

        // Nitro fill
        if (this.ui.nitroFill) {
            this.ui.nitroFill.style.width = `${p.nitro}%`;
        }

        // Position & Lap
        if (this.ui.position) {
            const suffix = ['TH', 'ST', 'ND', 'RD', 'TH', 'TH', 'TH'][p.rank] || 'TH';
            this.ui.position.innerHTML = `${p.rank}<sup>${suffix}</sup> <span style="font-size:0.6em; color:#94a3b8;">/ 6</span>`;
        }

        if (this.ui.lap) {
            const displayLap = Math.min(this.totalLaps, p.currentLap);
            this.ui.lap.textContent = `LAP ${displayLap} / ${this.totalLaps}`;
        }

        // Timer
        if (this.ui.time) {
            this.ui.time.textContent = this._formatTime(this.raceTime);
        }

        // Drift score display
        if (this.ui.driftScore) {
            if (p.isDrifting && p.driftScore > 10) {
                this.ui.driftScore.style.opacity = '1';
                this.ui.driftScore.textContent = `DRIFT: +${Math.floor(p.driftScore)}`;
            } else {
                this.ui.driftScore.style.opacity = '0';
            }
        }
    }

    _drawMinimap() {
        if (!this.minimapCtx || !this.minimapCanvas) return;
        const ctx = this.minimapCtx;
        const w = this.minimapCanvas.width;
        const h = this.minimapCanvas.height;

        ctx.clearRect(0, 0, w, h);

        // Track bounding box mapping to canvas
        // Track ranges roughly X: [-100, 650], Z: [-700, 650]
        const minX = -150, maxX = 700;
        const minZ = -750, maxZ = 680;

        const toMapX = (x) => ((x - minX) / (maxX - minX)) * (w - 24) + 12;
        const toMapY = (z) => (1.0 - (z - minZ) / (maxZ - minZ)) * (h - 24) + 12;

        // 1. Draw track line
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 8;
        ctx.beginPath();
        const samples = this.track.samplePoints;
        for (let i = 0; i < samples.length; i += 4) {
            const pt = samples[i];
            const mx = toMapX(pt.x);
            const my = toMapY(pt.z);
            if (i === 0) ctx.moveTo(mx, my);
            else ctx.lineTo(mx, my);
        }
        ctx.closePath();
        ctx.stroke();

        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // 2. Start/Finish checkered marker
        const sPt = samples[0];
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(toMapX(sPt.x), toMapY(sPt.z), 4, 0, Math.PI * 2);
        ctx.fill();

        // 3. Draw CPU car dots
        this.cpuRacers.forEach(ai => {
            const car = ai.car;
            ctx.fillStyle = `#${car.color.toString(16).padStart(6, '0')}`;
            ctx.beginPath();
            ctx.arc(toMapX(car.position.x), toMapY(car.position.z), 4.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1;
            ctx.stroke();
        });

        // 4. Draw Player Car (Bright cyan blinking marker with arrow)
        const p = this.player;
        const px = toMapX(p.position.x);
        const py = toMapY(p.position.z);

        ctx.save();
        ctx.translate(px, py);
        // Heading rotation on canvas (inverted Y)
        ctx.rotate(-p.heading);

        // Blinking glow
        ctx.shadowColor = '#00e5ff';
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#00e5ff';

        // Triangular vehicle arrow
        ctx.beginPath();
        ctx.moveTo(0, -7);
        ctx.lineTo(5, 5);
        ctx.lineTo(-5, 5);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }

    _formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        const ms = Math.floor((seconds * 100) % 100);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    }

    _onResize() {
        if (!this.camera || !this.renderer) return;
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}

// Global Game entrypoint
window.addEventListener('DOMContentLoaded', () => {
    window.game = new Game();
});

