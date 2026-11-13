/**
 * Vehicle Physics & 3D Car Model for 3D Arcade Racer
 * Supports Player and CPU cars, drifting, nitro, suspension roll, tire smoke, and skidmarks.
 */

class Car {
    constructor(scene, options = {}) {
        this.scene = scene;
        this.name = options.name || 'Racer';
        this.isPlayer = options.isPlayer || false;
        this.color = options.color || 0x00e5ff; // Paint color
        this.accentColor = options.accentColor || 0xff0055;
        this.number = options.number || 1;

        // Visual 3D Meshes
        this.root = new THREE.Group();
        this.bodyMesh = null;
        this.wheels = []; // [FL, FR, RL, RR]
        this.headlights = [];
        this.taillights = [];
        this.exhausts = [];
        this.shadow = null;

        // Vehicle specifications
        this.maxSpeed = options.maxSpeed || 72; // ~260 km/h in world units
        this.reverseMaxSpeed = 24;
        this.acceleration = options.acceleration || 38;
        this.braking = 55;
        this.drag = 0.985;
        this.steerSpeed = 2.4;
        this.maxSteerAngle = 0.65; // ~37 degrees

        // Dynamic State
        this.position = new THREE.Vector3();
        this.velocity = new THREE.Vector3();
        this.heading = 0; // Yaw angle in radians
        this.speed = 0;
        this.steerAngle = 0;
        this.targetSteerAngle = 0;
        this.gear = 1;
        this.rpm = 1000;

        // Drifting & Nitro
        this.isDrifting = false;
        this.driftAngle = 0; // Angle between heading and velocity
        this.driftScore = 0;
        this.nitro = 100; // 0 to 100
        this.isNitroActive = false;
        this.nitroDrainRate = 22; // points per second
        this.nitroRechargeRate = 4; // idle recharge per second

        // Suspension & Tilt
        this.pitch = 0;
        this.roll = 0;

        // Particles & Visual effects
        this.smokeParticles = [];
        this.nitroParticles = [];
        this.sparkParticles = [];

        // Race tracking stats
        this.currentLap = 1;
        this.trackProgress = 0; // 0 to 1
        this.raceDistance = 0; // Total distance traveled along spline
        this.lapStartTime = 0;
        this.lastLapTime = 0;
        this.bestLapTime = 0;
        this.totalRaceTime = 0;
        this.hasFinished = false;
        this.rank = 1;
        this.hasPassedHalfway = false;
        this.hasStartedFirstLap = false;
        this.prevPosition = new THREE.Vector3();
        this.prevTrackProgress = 0.98;

        // Build 3D model
        this._buildModel();
        this.scene.add(this.root);
    }

    _buildModel() {
        const carGroup = new THREE.Group();

        // 1. MAIN CHASSIS BODY (Sculpted sports supercar)
        const bodyMat = new THREE.MeshStandardMaterial({
            color: this.color,
            metalness: 0.85,
            roughness: 0.25,
            clearcoat: 1.0,
            clearcoatRoughness: 0.1
        });

        const darkCarbonMat = new THREE.MeshStandardMaterial({
            color: 0x11161f,
            metalness: 0.7,
            roughness: 0.4
        });

        const glassMat = new THREE.MeshPhysicalMaterial({
            color: 0x0a101d,
            metalness: 0.9,
            roughness: 0.1,
            transmission: 0.7,
            transparent: true,
            opacity: 0.85
        });

        // Lower body base
        const lowerBodyGeom = new THREE.BoxGeometry(2.1, 0.55, 4.8);
        const lowerBody = new THREE.Mesh(lowerBodyGeom, bodyMat);
        lowerBody.position.y = 0.5;
        lowerBody.castShadow = true;
        carGroup.add(lowerBody);

        // Cockpit cabin / roof
        const cabinGeom = new THREE.BoxGeometry(1.6, 0.55, 2.3);
        const cabin = new THREE.Mesh(cabinGeom, glassMat);
        cabin.position.set(0, 0.95, -0.2);
        cabin.castShadow = true;
        carGroup.add(cabin);

        // Roof panel
        const roof = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 1.8), bodyMat);
        roof.position.set(0, 1.25, -0.2);
        carGroup.add(roof);

        // Front Hood scoop / wedge
        const hoodGeom = new THREE.BoxGeometry(1.9, 0.35, 1.6);
        const hood = new THREE.Mesh(hoodGeom, bodyMat);
        hood.position.set(0, 0.65, 1.5);
        hood.rotation.x = 0.08;
        carGroup.add(hood);

        // Front Splitter / bumper
        const splitter = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 0.6), darkCarbonMat);
        splitter.position.set(0, 0.25, 2.4);
        carGroup.add(splitter);

        // Side Skirts
        [-1.1, 1.1].forEach(side => {
            const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 3.2), darkCarbonMat);
            skirt.position.set(side, 0.28, 0);
            carGroup.add(skirt);
        });

        // Rear Diffuser
        const diffuser = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.3, 0.5), darkCarbonMat);
        diffuser.position.set(0, 0.32, -2.4);
        carGroup.add(diffuser);

        // Rear GT Spoiler Wing
        const spoilerWing = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 0.65), bodyMat);
        spoilerWing.position.set(0, 1.28, -2.2);

        // Spoiler mounts
        [-0.7, 0.7].forEach(mx => {
            const mount = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.45, 0.25), darkCarbonMat);
            mount.position.set(mx, 1.05, -2.15);
            carGroup.add(mount);
        });
        carGroup.add(spoilerWing);

        // Racing Stripe / Accent line down center
        const stripeMat = new THREE.MeshStandardMaterial({
            color: this.accentColor,
            roughness: 0.3,
            metalness: 0.5
        });
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.02, 4.4), stripeMat);
        stripe.position.set(0, 0.79, 0.2);
        carGroup.add(stripe);

        // 2. WHEELS (FL, FR, RL, RR)
        const wheelGeom = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 18);
        wheelGeom.rotateZ(Math.PI / 2);

        const tireMat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.8 });
        const rimMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.9, roughness: 0.2 });

        const wheelPositions = [
            { x: -1.05, y: 0.42, z: 1.45, isFront: true },  // FL
            { x:  1.05, y: 0.42, z: 1.45, isFront: true },  // FR
            { x: -1.05, y: 0.42, z: -1.45, isFront: false }, // RL
            { x:  1.05, y: 0.42, z: -1.45, isFront: false }  // RR
        ];

        this.wheels = [];
        wheelPositions.forEach(wp => {
            const wheelAnchor = new THREE.Group();
            wheelAnchor.position.set(wp.x, wp.y, wp.z);

            const wheelMesh = new THREE.Mesh(wheelGeom, tireMat);
            wheelMesh.castShadow = true;

            // Alloy Rim cap
            const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.36, 12), rimMat);
            rim.rotateZ(Math.PI / 2);
            wheelMesh.add(rim);

            wheelAnchor.add(wheelMesh);
            carGroup.add(wheelAnchor);

            this.wheels.push({
                anchor: wheelAnchor,
                mesh: wheelMesh,
                isFront: wp.isFront
            });
        });

        // 3. HEADLIGHTS (Glowing cyan / white)
        const lightMat = new THREE.MeshBasicMaterial({ color: 0xe0f7fa });
        [-0.75, 0.75].forEach(lx => {
            const hl = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.15, 0.1), lightMat);
            hl.position.set(lx, 0.58, 2.42);
            carGroup.add(hl);
            this.headlights.push(hl);
        });

        // 4. TAILLIGHTS (Glowing LED bar)
        this.tailLightMat = new THREE.MeshBasicMaterial({ color: 0x990000 });
        [-0.75, 0.75].forEach(lx => {
            const tl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.1), this.tailLightMat);
            tl.position.set(lx, 0.65, -2.42);
            carGroup.add(tl);
            this.taillights.push(tl);
        });

        // 5. TWIN EXHAUST PIPES
        const exhaustMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.9 });
        [-0.35, 0.35].forEach(ex => {
            const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.3, 12), exhaustMat);
            pipe.rotation.x = Math.PI / 2;
            pipe.position.set(ex, 0.32, -2.45);
            carGroup.add(pipe);
            this.exhausts.push(pipe);
        });

        // 6. CAR SHADOW PLANE (Soft simulated ground shadow)
        const shadowCanvas = document.createElement('canvas');
        shadowCanvas.width = 128;
        shadowCanvas.height = 128;
        const sCtx = shadowCanvas.getContext('2d');
        const grad = sCtx.createRadialGradient(64, 64, 10, 64, 64, 60);
        grad.addColorStop(0, 'rgba(0, 0, 0, 0.65)');
        grad.addColorStop(0.7, 'rgba(0, 0, 0, 0.3)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        sCtx.fillStyle = grad;
        sCtx.fillRect(0, 0, 128, 128);

        const shadowTex = new THREE.CanvasTexture(shadowCanvas);
        const shadowGeom = new THREE.PlaneGeometry(3.0, 5.4);
        shadowGeom.rotateX(-Math.PI / 2);
        const shadowMat = new THREE.MeshBasicMaterial({
            map: shadowTex,
            transparent: true,
            opacity: 0.8,
            depthWrite: false
        });
        this.shadow = new THREE.Mesh(shadowGeom, shadowMat);
        this.shadow.position.y = 0.04;
        carGroup.add(this.shadow);

        this.bodyMesh = carGroup;
        this.root.add(carGroup);
    }

    /**
     * Set world starting position and orientation
     */
    setGridPosition(pos, heading) {
        this.position.copy(pos);
        this.prevPosition.copy(pos);
        this.heading = heading;
        this.speed = 0;
        this.velocity.set(0, 0, 0);
        this.root.position.copy(this.position);
        this.root.rotation.y = this.heading;
        this.prevTrackProgress = 0.98;
    }

    /**
     * Physics update loop
     */
    update(dt, input, track) {
        if (!dt || dt > 0.1) dt = 0.016;

        // Save position and track progress before integration for crossing detection
        this.prevPosition.copy(this.position);
        this.prevTrackProgress = (this.trackProgress !== undefined) ? this.trackProgress : 0.98;

        const isThrottle = input.forward || false;
        const isBraking = input.reverse || false;
        const isHandbrake = input.handbrake || false;
        const wantNitro = input.nitro || false;
        const steerDir = (input.left ? 1 : 0) - (input.right ? 1 : 0);

        // Track limits: asphalt halfwidth 12.0 + curb 1.8 - car offset = 12.5
        const maxLateral = (track.trackWidth / 2) + 0.5;

        // Steering boundary check: prevent steering further into a wall if already on the boundary
        const preTrackInfo = track.findClosestTrackPoint(this.position);
        let effectiveSteerDir = steerDir;
        if (preTrackInfo.lateralOffset >= maxLateral - 0.4 && steerDir < 0) {
            effectiveSteerDir = 0; // block further right steering into wall
        } else if (preTrackInfo.lateralOffset <= -maxLateral + 0.4 && steerDir > 0) {
            effectiveSteerDir = 0; // block further left steering into wall
        }

        // 1. NITRO SYSTEM
        if (wantNitro && this.nitro > 0 && this.speed > 5) {
            this.isNitroActive = true;
            this.nitro = Math.max(0, this.nitro - this.nitroDrainRate * dt);
        } else {
            this.isNitroActive = false;
            // Slow recharge
            this.nitro = Math.min(100, this.nitro + this.nitroRechargeRate * dt);
        }

        // Effective max speed and acceleration
        let currentMaxSpeed = this.isNitroActive ? (this.maxSpeed * 1.35) : this.maxSpeed;
        let currentAccel = this.isNitroActive ? (this.acceleration * 1.8) : this.acceleration;

        // Check if on curb edge
        if (Math.abs(preTrackInfo.lateralOffset) > (track.trackWidth / 2)) {
            currentMaxSpeed *= 0.88; // Slight curb rumble resistance
        }

        // 2. ACCELERATION & BRAKING
        if (isThrottle) {
            if (this.speed < currentMaxSpeed) {
                this.speed += currentAccel * dt;
            }
        } else if (isBraking) {
            if (this.speed > 0) {
                this.speed -= this.braking * dt;
                if (this.speed < 0) this.speed = 0;
            } else if (this.speed > -this.reverseMaxSpeed) {
                this.speed -= (this.acceleration * 0.6) * dt; // Reverse gear
            }
        } else {
            // Natural friction / rolling resistance
            this.speed *= Math.pow(this.drag, dt * 60);
            if (Math.abs(this.speed) < 0.2) this.speed = 0;
        }

        // 3. STEERING & DRIFTING
        // Steering is more responsive at mid speeds, dampened at ultra high speeds for precision
        const speedNorm = Math.min(1, Math.abs(this.speed) / 40);
        this.targetSteerAngle = effectiveSteerDir * this.maxSteerAngle * (0.3 + 0.7 * (1 - speedNorm * 0.35));
        this.steerAngle += (this.targetSteerAngle - this.steerAngle) * this.steerSpeed * 8 * dt;

        // Handbrake / Drift check
        const isHardCornering = (Math.abs(this.steerAngle) > 0.3 && Math.abs(this.speed) > 30);
        this.isDrifting = (isHandbrake && Math.abs(this.speed) > 15) || isHardCornering;

        let turnRate = (this.speed / 4.8) * Math.tan(this.steerAngle) * dt;
        if (this.isDrifting) {
            turnRate *= 1.45; // Faster rotation into drift
            this.speed *= (1 - 0.15 * dt); // Drift friction scrub
            this.driftScore += Math.abs(this.speed) * dt * 10;
            // Drifting recharges nitro!
            this.nitro = Math.min(100, this.nitro + 12 * dt);
        }

        this.heading += turnRate;

        // Visual drift slip angle
        const targetDriftAngle = this.isDrifting ? (-this.steerAngle * 0.8) : 0;
        this.driftAngle += (targetDriftAngle - this.driftAngle) * 6 * dt;

        // 4. VELOCITY INTEGRATION
        const forwardX = Math.sin(this.heading);
        const forwardZ = Math.cos(this.heading);

        this.velocity.x = forwardX * this.speed;
        this.velocity.z = forwardZ * this.speed;

        this.position.x += this.velocity.x * dt;
        this.position.z += this.velocity.z * dt;

        // 4b. STRICT TRACK BOUNDARY ENFORCEMENT & BARRIER COLLISION
        const postTrackInfo = track.findClosestTrackPoint(this.position);
        this.trackProgress = postTrackInfo.t;
        this.position.y = postTrackInfo.point.y;

        const lateralOffset = postTrackInfo.lateralOffset;
        const trackNorm = postTrackInfo.normal;
        const trackTan = postTrackInfo.tangent;

        // Enforce Right Boundary (lateralOffset > maxLateral)
        if (lateralOffset > maxLateral) {
            // Strictly clamp position to edge of barrier
            const penetration = lateralOffset - maxLateral;
            this.position.x -= trackNorm.x * penetration;
            this.position.z -= trackNorm.z * penetration;

            const outwardSpeed = this.velocity.dot(trackNorm);
            if (outwardSpeed > 0) {
                // Elastic bounce inward
                const bounceForce = Math.min(22, Math.max(6, outwardSpeed * 1.5));
                this.velocity.x -= trackNorm.x * (bounceForce * 1.3);
                this.velocity.z -= trackNorm.z * (bounceForce * 1.3);

                // Speed scrub from barrier scrape
                this.speed *= 0.88;

                // Deflect heading to glide along the track curve
                if (this.speed > 2) {
                    const trackHeading = Math.atan2(trackTan.x, trackTan.z);
                    let dH = trackHeading - this.heading;
                    while (dH > Math.PI) dH -= Math.PI * 2;
                    while (dH < -Math.PI) dH += Math.PI * 2;
                    this.heading += dH * 0.45;
                }

                if (this.isPlayer && window.soundSystem && Math.abs(this.speed) > 4) {
                    window.soundSystem.playCollision(Math.min(0.8, Math.abs(this.speed) / 35));
                }
                this._spawnBarrierSparks(trackNorm, 1);
            }
        }
        // Enforce Left Boundary (lateralOffset < -maxLateral)
        else if (lateralOffset < -maxLateral) {
            // Strictly clamp position to edge of barrier
            const penetration = -maxLateral - lateralOffset;
            this.position.x += trackNorm.x * penetration;
            this.position.z += trackNorm.z * penetration;

            const outwardSpeed = this.velocity.dot(trackNorm);
            if (outwardSpeed < 0) {
                const bounceForce = Math.min(22, Math.max(6, Math.abs(outwardSpeed) * 1.5));
                this.velocity.x -= trackNorm.x * (bounceForce * 1.3);
                this.velocity.z -= trackNorm.z * (bounceForce * 1.3);

                this.speed *= 0.88;

                if (this.speed > 2) {
                    const trackHeading = Math.atan2(trackTan.x, trackTan.z);
                    let dH = trackHeading - this.heading;
                    while (dH > Math.PI) dH -= Math.PI * 2;
                    while (dH < -Math.PI) dH += Math.PI * 2;
                    this.heading += dH * 0.45;
                }

                if (this.isPlayer && window.soundSystem && Math.abs(this.speed) > 4) {
                    window.soundSystem.playCollision(Math.min(0.8, Math.abs(this.speed) / 35));
                }
                this._spawnBarrierSparks(trackNorm, -1);
            }
        }

        // 5. GEAR & RPM CALCULATION
        const speedKmh = Math.abs(this.speed) * 3.6;
        if (this.speed < -0.1) {
            this.gear = 'R';
            this.rpm = 1000 + Math.abs(this.speed) * 150;
        } else if (speedKmh < 1) {
            this.gear = 'N';
            this.rpm = isThrottle ? 5500 : 1000;
        } else {
            const gearThresholds = [0, 50, 105, 160, 215, 999];
            for (let g = 1; g <= 5; g++) {
                if (speedKmh <= gearThresholds[g] || g === 5) {
                    this.gear = g;
                    const minSpeed = gearThresholds[g - 1];
                    const maxSpeed = gearThresholds[g];
                    const fraction = (speedKmh - minSpeed) / (maxSpeed - minSpeed);
                    this.rpm = 2500 + fraction * 5500;
                    break;
                }
            }
        }

        // 6. SUSPENSION ROLL & PITCH
        const targetRoll = -this.steerAngle * (this.speed / this.maxSpeed) * 0.16;
        const targetPitch = (isThrottle ? -0.04 : (isBraking ? 0.06 : 0));
        this.roll += (targetRoll - this.roll) * 8 * dt;
        this.pitch += (targetPitch - this.pitch) * 8 * dt;

        // 7. SYNC 3D MESH
        this.root.position.copy(this.position);
        this.root.rotation.y = this.heading + this.driftAngle;
        this.bodyMesh.rotation.z = this.roll;
        this.bodyMesh.rotation.x = this.pitch;

        // Animate wheels
        const wheelRoll = (this.speed / 0.42) * dt;
        this.wheels.forEach(w => {
            w.mesh.rotation.x += wheelRoll;
            if (w.isFront) {
                w.anchor.rotation.y = this.steerAngle;
            }
        });

        // Taillights brighten on brake
        if (this.tailLightMat) {
            if (isBraking || this.isDrifting) {
                this.tailLightMat.color.setHex(0xff0000);
            } else {
                this.tailLightMat.color.setHex(0x550000);
            }
        }

        // 8. PARTICLES (Tire Smoke & Nitro Flame)
        this._updateParticles(dt, isThrottle, isBraking);

        // Sound update if player
        if (this.isPlayer && window.soundSystem) {
            window.soundSystem.updateEngine(this.speed, this.maxSpeed, isThrottle, typeof this.gear === 'number' ? this.gear : 1);
            window.soundSystem.setDriftIntensity(this.isDrifting ? 0.8 : 0);
            window.soundSystem.setNitroActive(this.isNitroActive);
        }
    }

    _updateParticles(dt, isThrottle, isBraking) {
        // Rear tire smoke when drifting or launching hard
        if (this.isDrifting || (isThrottle && Math.abs(this.speed) < 15 && isBraking)) {
            [-1, 1].forEach(side => {
                const smokeGeom = new THREE.SphereGeometry(0.35 + Math.random() * 0.2, 5, 5);
                const smokeMat = new THREE.MeshBasicMaterial({
                    color: 0xcccccc,
                    transparent: true,
                    opacity: 0.5
                });
                const smoke = new THREE.Mesh(smokeGeom, smokeMat);

                // Spawn at rear wheel location
                const worldPos = new THREE.Vector3(side * 1.05, 0.4, -1.45).applyMatrix4(this.root.matrixWorld);
                smoke.position.copy(worldPos);

                this.scene.add(smoke);
                this.smokeParticles.push({
                    mesh: smoke,
                    life: 1.0,
                    decay: 1.8 + Math.random() * 0.6,
                    vx: (Math.random() - 0.5) * 1.5,
                    vy: 0.8 + Math.random() * 0.8,
                    vz: (Math.random() - 0.5) * 1.5
                });
            });
        }

        // Nitro exhaust flames
        if (this.isNitroActive) {
            this.exhausts.forEach(pipe => {
                const flameGeom = new THREE.ConeGeometry(0.18, 0.8, 6);
                flameGeom.rotateX(-Math.PI / 2);
                const flameColor = Math.random() > 0.4 ? 0x00e5ff : 0xff3d00;
                const flameMat = new THREE.MeshBasicMaterial({ color: flameColor, transparent: true, opacity: 0.9 });
                const flame = new THREE.Mesh(flameGeom, flameMat);

                const pipeWorld = pipe.getWorldPosition(new THREE.Vector3());
                flame.position.copy(pipeWorld);
                flame.rotation.y = this.root.rotation.y;

                this.scene.add(flame);
                this.nitroParticles.push({
                    mesh: flame,
                    life: 0.15,
                    decay: 6.0
                });
            });
        }

        // Update smoke particle lifespans
        for (let i = this.smokeParticles.length - 1; i >= 0; i--) {
            const p = this.smokeParticles[i];
            p.life -= p.decay * dt;
            if (p.life <= 0) {
                this.scene.remove(p.mesh);
                p.mesh.geometry.dispose();
                p.mesh.material.dispose();
                this.smokeParticles.splice(i, 1);
            } else {
                p.mesh.position.x += p.vx * dt;
                p.mesh.position.y += p.vy * dt;
                p.mesh.position.z += p.vz * dt;
                p.mesh.scale.multiplyScalar(1 + dt * 2.2);
                p.mesh.material.opacity = p.life * 0.45;
            }
        }

        // Update nitro particle lifespans
        for (let i = this.nitroParticles.length - 1; i >= 0; i--) {
            const p = this.nitroParticles[i];
            p.life -= p.decay * dt;
            if (p.life <= 0) {
                this.scene.remove(p.mesh);
                p.mesh.geometry.dispose();
                p.mesh.material.dispose();
                this.nitroParticles.splice(i, 1);
            } else {
                p.mesh.scale.multiplyScalar(1 - dt * 4.0);
            }
        }

        // Update barrier spark particles
        for (let i = this.sparkParticles.length - 1; i >= 0; i--) {
            const p = this.sparkParticles[i];
            p.life -= p.decay * dt;
            if (p.life <= 0) {
                this.scene.remove(p.mesh);
                p.mesh.geometry.dispose();
                p.mesh.material.dispose();
                this.sparkParticles.splice(i, 1);
            } else {
                p.mesh.position.x += p.vx * dt;
                p.mesh.position.y += p.vy * dt;
                p.mesh.position.z += p.vz * dt;
                p.vy -= 12 * dt; // Gravity
                p.mesh.scale.multiplyScalar(Math.max(0.01, 1 - dt * 2.5));
            }
        }
    }

    _spawnBarrierSparks(normal, side) {
        const count = 5;
        for (let i = 0; i < count; i++) {
            const sparkGeom = new THREE.SphereGeometry(0.1 + Math.random() * 0.08, 4, 4);
            const sparkColor = Math.random() > 0.35 ? 0xffea00 : 0xff5722; // Hot yellow / orange
            const sparkMat = new THREE.MeshBasicMaterial({ color: sparkColor });
            const spark = new THREE.Mesh(sparkGeom, sparkMat);

            // Side contact point along the car flank
            const localX = side * 1.1;
            const localZ = (Math.random() - 0.5) * 3.2;
            const worldPos = new THREE.Vector3(localX, 0.45, localZ).applyMatrix4(this.root.matrixWorld);
            spark.position.copy(worldPos);

            this.scene.add(spark);
            this.sparkParticles.push({
                mesh: spark,
                life: 0.3 + Math.random() * 0.15,
                decay: 2.8,
                vx: -normal.x * (3 + Math.random() * 5) + (Math.random() - 0.5) * 3,
                vy: 2.5 + Math.random() * 3.5,
                vz: -normal.z * (3 + Math.random() * 5) + (Math.random() - 0.5) * 3
            });
        }
    }

    /**
     * Elastic collision impulse against another car
     */
    applyImpulse(normal, strength = 15) {
        this.position.x += normal.x * strength * 0.05;
        this.position.z += normal.z * strength * 0.05;
        this.speed *= 0.75; // Energy loss in collision

        if (this.isPlayer && window.soundSystem) {
            window.soundSystem.playCollision(strength / 20);
        }
    }
}

window.Car = Car;

