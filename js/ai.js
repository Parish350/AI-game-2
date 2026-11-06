/**
 * Multi-Car CPU AI System for 3D Arcade Racer
 * Simulates intelligent opponent drivers with distinct racing lines, overtaking, corner braking, and nitro tactics.
 */

class AICarController {
    constructor(car, track, profile = {}) {
        this.car = car;
        this.track = track;

        // Personality & Skill Profile
        this.name = profile.name || 'CPU Racer';
        this.skill = profile.skill || 0.85; // 0 to 1
        this.aggression = profile.aggression || 0.7; // Frequency of overtakes & nitro
        this.preferredLaneOffset = profile.preferredLaneOffset || 0; // -6 (left) to +6 (right)
        this.targetLaneOffset = this.preferredLaneOffset;
        this.corneringPatience = profile.corneringPatience || 0.8;

        // Lookahead parameters
        this.baseLookaheadDist = 28; // meters
        this.overtakeTimer = 0;
        this.nitroCooldown = 4 + Math.random() * 5;

        // Input object passed to car.update()
        this.input = {
            forward: false,
            reverse: false,
            left: false,
            right: false,
            handbrake: false,
            nitro: false
        };
    }

    /**
     * Compute AI decisions and control inputs for this frame
     */
    update(dt, allCars) {
        const car = this.car;
        const track = this.track;
        const pos = car.position;

        // Reset inputs
        this.input.forward = false;
        this.input.reverse = false;
        this.input.left = false;
        this.input.right = false;
        this.input.handbrake = false;
        this.input.nitro = false;

        // 1. DETERMINE CURRENT TRACK POSITION & LOOKAHEAD TARGET
        const trackInfo = track.findClosestTrackPoint(pos);
        const currentT = trackInfo.t;

        // Dynamic lookahead distance scales with current speed
        const speedRatio = Math.max(0.1, car.speed / car.maxSpeed);
        const lookaheadDist = this.baseLookaheadDist + speedRatio * 32;
        const lookaheadDeltaT = lookaheadDist / track.trackLength;
        const targetT = (currentT + lookaheadDeltaT) % 1.0;

        // 2. DETECT CURVATURE AHEAD FOR CORNER BRAKING
        const cornerSampleT = (currentT + (speedRatio * 45) / track.trackLength) % 1.0;
        const curTan = trackInfo.tangent;
        const aheadTan = track.getTangentAt(cornerSampleT);
        const curveAngle = Math.abs(curTan.angleTo(aheadTan)); // In radians

        // Safe cornering speed based on curve sharpness
        let targetSpeed = car.maxSpeed;
        if (curveAngle > 0.3) {
            // Sharp turn ahead: reduce speed
            const cornerSharpness = Math.min(1.0, curveAngle / 1.1);
            targetSpeed = car.maxSpeed * (1.0 - cornerSharpness * (1.1 - this.corneringPatience * 0.4));
            targetSpeed = Math.max(22, targetSpeed);
        }

        // 3. RADAR & TRAFFIC SENSING (AVOIDANCE & OVERTAKING)
        this.overtakeTimer -= dt;
        let carDirectlyAhead = null;
        let closestAheadDist = Infinity;

        for (let other of allCars) {
            if (other === car) continue;

            const toOther = new THREE.Vector3().subVectors(other.position, pos);
            const dist = toOther.length();

            if (dist < 45) {
                // Check if other is ahead along heading
                const forwardVec = new THREE.Vector3(Math.sin(car.heading), 0, Math.cos(car.heading));
                const dot = forwardVec.dot(toOther.clone().normalize());

                if (dot > 0.65 && dist < closestAheadDist) {
                    closestAheadDist = dist;
                    carDirectlyAhead = other;
                }
            }
        }

        // If trapped behind a slower car, plan an overtake maneuver
        if (carDirectlyAhead && closestAheadDist < 25 && this.overtakeTimer <= 0) {
            // If we are moving faster, switch lanes to pass
            if (car.speed >= carDirectlyAhead.speed * 0.9) {
                const myOffset = trackInfo.lateralOffset;
                // Choose the lane with more track clearance
                if (myOffset > 0) {
                    this.targetLaneOffset = -5.5; // pass on inside left
                } else {
                    this.targetLaneOffset = 5.5;  // pass on outside right
                }
                this.overtakeTimer = 2.5; // stick to pass line for 2.5 seconds
            }
        } else if (this.overtakeTimer <= 0) {
            // Return to preferred racing line
            this.targetLaneOffset = this.preferredLaneOffset;
        }

        // Keep lane offset well within track asphalt
        this.targetLaneOffset = Math.max(-7.5, Math.min(7.5, this.targetLaneOffset));

        // Edge avoidance: if close to left or right boundary, steer back toward center
        if (trackInfo.lateralOffset > 8.5) {
            this.targetLaneOffset = Math.min(this.targetLaneOffset, 1.0);
        } else if (trackInfo.lateralOffset < -8.5) {
            this.targetLaneOffset = Math.max(this.targetLaneOffset, -1.0);
        }

        // 4. COMPUTE TARGET 3D STEERING WAYPOINT
        const targetCenterPt = track.getPointAt(targetT);
        const targetNormal = new THREE.Vector3().crossVectors(
            track.getTangentAt(targetT),
            new THREE.Vector3(0, 1, 0)
        ).normalize();

        // Offset waypoint across track width
        const desiredWaypoint = new THREE.Vector3(
            targetCenterPt.x + targetNormal.x * this.targetLaneOffset,
            targetCenterPt.y,
            targetCenterPt.z + targetNormal.z * this.targetLaneOffset
        );

        // Compute angle error to waypoint
        const toTarget = new THREE.Vector3().subVectors(desiredWaypoint, pos);
        const desiredHeading = Math.atan2(toTarget.x, toTarget.z);
        let headingError = desiredHeading - car.heading;

        // Wrap to [-PI, PI]
        while (headingError > Math.PI) headingError -= Math.PI * 2;
        while (headingError < -Math.PI) headingError += Math.PI * 2;

        // Steer inputs
        const steerTolerance = 0.05;
        if (headingError > steerTolerance) {
            this.input.left = true;
        } else if (headingError < -steerTolerance) {
            this.input.right = true;
        }

        // Drift on very sharp corners if aggressive
        if (curveAngle > 0.65 && car.speed > 35 && this.aggression > 0.6) {
            this.input.handbrake = true;
        }

        // 5. THROTTLE & BRAKING LOGIC
        if (car.speed < targetSpeed) {
            this.input.forward = true;
        } else if (car.speed > targetSpeed + 4) {
            this.input.reverse = true; // Brake
        }

        // Emergency braking if dangerously close to rear bumper of car ahead
        if (carDirectlyAhead && closestAheadDist < 5.5 && car.speed > carDirectlyAhead.speed) {
            this.input.forward = false;
            this.input.reverse = true;
        }

        // 6. NITRO BOOST TACTICS
        this.nitroCooldown -= dt;
        if (this.nitroCooldown <= 0 && car.nitro > 40) {
            // Use nitro on straights when curve angle is low and going fast
            if (curveAngle < 0.25 && car.speed > 38 && (this.overtakeTimer > 0 || Math.random() < this.aggression)) {
                this.input.nitro = true;
                if (car.nitro < 15) {
                    this.nitroCooldown = 6 + Math.random() * 8; // Rest after burst
                }
            }
        }

        // Execute physics update for CPU car
        car.update(dt, this.input, track);
    }
}

window.AICarController = AICarController;

