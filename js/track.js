/**
 * Track Generator for 3D Arcade Racer
 * Procedural circuit spline, asphalt mesh, kerbs, barriers, grandstands, billboards, and scenery.
 */

class RaceTrack {
    constructor(scene) {
        this.scene = scene;
        this.trackWidth = 24;
        this.trackLength = 0;
        this.curve = null;
        this.trackMesh = null;
        this.barriers = [];
        this.pointsCount = 600;
        this.samplePoints = [];
        this.sampleTangents = [];
        this.sampleNormals = [];
        this.sampleDistances = [];

        this._createCurve();
        this._precomputeSamples();
        this._buildTrackGeometry();
        this._buildCurbsAndBarriers();
        this._buildFinishArch();
        this._buildGrandstands();
        this._buildFloodlights();
        this._buildBillboards();
        this._buildScenery();
    }

    _createCurve() {
        // High-speed circuit with straightaways, banked sweeping turns, chicanes, and hairpins
        const controlPoints = [
            new THREE.Vector3(0, 0, 0),        // Start / Finish straight
            new THREE.Vector3(0, 0, 300),      // Straightaway
            new THREE.Vector3(60, 2, 480),     // Turn 1 entry
            new THREE.Vector3(180, 5, 600),    // Sweeping right bend
            new THREE.Vector3(340, 6, 620),    // Banked curve apex
            new THREE.Vector3(480, 4, 520),    // Exit to straight
            new THREE.Vector3(520, 2, 360),    // Transition
            new THREE.Vector3(440, 1, 240),    // S-Chicane left
            new THREE.Vector3(560, 3, 100),    // S-Chicane right
            new THREE.Vector3(620, 5, -80),    // Back straight entry
            new THREE.Vector3(600, 7, -300),   // High speed back straight (hill crest)
            new THREE.Vector3(520, 4, -480),   // Back straight descent
            new THREE.Vector3(380, 2, -600),   // Hairpin entry
            new THREE.Vector3(200, 0, -660),   // Tight hairpin turn apex
            new THREE.Vector3(60, 0, -580),    // Hairpin exit
            new THREE.Vector3(-40, 1, -440),   // Carousel curve
            new THREE.Vector3(-80, 3, -260),   // Sweeping entry
            new THREE.Vector3(-50, 1, -100)    // Final turn onto home straight
        ];

        this.curve = new THREE.CatmullRomCurve3(controlPoints, true, 'centripetal', 0.5);
        this.trackLength = this.curve.getLength();
    }

    _precomputeSamples() {
        this.samplePoints = [];
        this.sampleTangents = [];
        this.sampleNormals = [];
        this.sampleDistances = [];

        let accumulatedDist = 0;
        let prevPoint = this.curve.getPointAt(0);

        for (let i = 0; i <= this.pointsCount; i++) {
            const t = i / this.pointsCount;
            const pt = this.curve.getPointAt(t);
            const tan = this.curve.getTangentAt(t).normalize();
            
            // Standard up vector, compute lateral normal perpendicular to tangent
            const up = new THREE.Vector3(0, 1, 0);
            const norm = new THREE.Vector3().crossVectors(tan, up).normalize();

            this.samplePoints.push(pt);
            this.sampleTangents.push(tan);
            this.sampleNormals.push(norm);

            if (i > 0) {
                accumulatedDist += pt.distanceTo(prevPoint);
            }
            this.sampleDistances.push(accumulatedDist);
            prevPoint = pt;
        }
    }

    _generateRoadTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 1024;
        const ctx = canvas.getContext('2d');

        // Dark asphalt base
        ctx.fillStyle = '#181b22';
        ctx.fillRect(0, 0, 1024, 1024);

        // Asphalt grain noise
        for (let i = 0; i < 25000; i++) {
            const x = Math.random() * 1024;
            const y = Math.random() * 1024;
            const c = Math.floor(Math.random() * 30 + 20);
            ctx.fillStyle = `rgb(${c},${c},${c})`;
            ctx.fillRect(x, y, 2, 2);
        }

        // White outer edge lines
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(16, 0, 18, 1024);
        ctx.fillRect(1024 - 34, 0, 18, 1024);

        // Yellow inner shoulder lines
        ctx.fillStyle = '#ffcc00';
        ctx.fillRect(40, 0, 10, 1024);
        ctx.fillRect(1024 - 50, 0, 10, 1024);

        // Dashed lane divider lines (3 lanes)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        const lane1X = 1024 * (1 / 3);
        const lane2X = 1024 * (2 / 3);
        for (let y = 0; y < 1024; y += 64) {
            ctx.fillRect(lane1X - 4, y, 8, 36);
            ctx.fillRect(lane2X - 4, y, 8, 36);
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(1, 100); // 100 repeats along track length
        return texture;
    }

    _buildTrackGeometry() {
        const segments = this.pointsCount;
        const geom = new THREE.BufferGeometry();
        const positions = [];
        const normals = [];
        const uvs = [];
        const indices = [];

        const halfWidth = this.trackWidth / 2;

        for (let i = 0; i <= segments; i++) {
            const pt = this.samplePoints[i];
            const norm = this.sampleNormals[i];
            const v = (i / segments) * 100;

            // Left track edge
            const leftX = pt.x - norm.x * halfWidth;
            const leftY = pt.y + 0.05;
            const leftZ = pt.z - norm.z * halfWidth;

            // Right track edge
            const rightX = pt.x + norm.x * halfWidth;
            const rightY = pt.y + 0.05;
            const rightZ = pt.z + norm.z * halfWidth;

            positions.push(leftX, leftY, leftZ);
            positions.push(rightX, rightY, rightZ);

            normals.push(0, 1, 0);
            normals.push(0, 1, 0);

            uvs.push(0, v);
            uvs.push(1, v);

            if (i < segments) {
                const idx = i * 2;
                indices.push(idx, idx + 1, idx + 2);
                indices.push(idx + 1, idx + 3, idx + 2);
            }
        }

        geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geom.setIndex(indices);

        const roadMat = new THREE.MeshStandardMaterial({
            map: this._generateRoadTexture(),
            roughness: 0.8,
            metalness: 0.1
        });

        this.trackMesh = new THREE.Mesh(geom, roadMat);
        this.trackMesh.receiveShadow = true;
        this.scene.add(this.trackMesh);

        // Checkered Start/Finish Line decal on road
        this._buildFinishLine();
    }

    _buildFinishLine() {
        const startPt = this.samplePoints[0];
        const startTan = this.sampleTangents[0];
        const startNorm = this.sampleNormals[0];

        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');

        // Checkered pattern
        const rows = 4;
        const cols = 16;
        const w = 512 / cols;
        const h = 128 / rows;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                ctx.fillStyle = (r + c) % 2 === 0 ? '#ffffff' : '#111111';
                ctx.fillRect(c * w, r * h, w, h);
            }
        }

        const texture = new THREE.CanvasTexture(canvas);
        const geom = new THREE.PlaneGeometry(this.trackWidth, 12);
        const mat = new THREE.MeshBasicMaterial({
            map: texture,
            polygonOffset: true,
            polygonOffsetFactor: -2,
            polygonOffsetUnits: -2
        });

        const mesh = new THREE.Mesh(geom, mat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(startPt.x, startPt.y + 0.12, startPt.z);
        // Align rotation with track tangent
        const angle = Math.atan2(startTan.x, startTan.z);
        mesh.rotation.z = -angle;

        this.scene.add(mesh);
    }

    _buildCurbsAndBarriers() {
        const segments = this.pointsCount;
        const halfWidth = this.trackWidth / 2;
        const curbWidth = 1.8;

        // Red and white kerbs along both edges
        const curbCanvas = document.createElement('canvas');
        curbCanvas.width = 128;
        curbCanvas.height = 128;
        const curbCtx = curbCanvas.getContext('2d');
        curbCtx.fillStyle = '#d50000'; // Race red
        curbCtx.fillRect(0, 0, 128, 64);
        curbCtx.fillStyle = '#ffffff'; // White
        curbCtx.fillRect(0, 64, 128, 64);

        const curbTex = new THREE.CanvasTexture(curbCanvas);
        curbTex.wrapS = THREE.RepeatWrapping;
        curbTex.wrapT = THREE.RepeatWrapping;
        curbTex.repeat.set(1, 200);

        const curbMat = new THREE.MeshStandardMaterial({
            map: curbTex,
            roughness: 0.6
        });

        // Outer barrier material with neon warning glow
        const barrierMat = new THREE.MeshStandardMaterial({
            color: 0x334455,
            metalness: 0.8,
            roughness: 0.3
        });

        const barrierStripeCanvas = document.createElement('canvas');
        barrierStripeCanvas.width = 256;
        barrierStripeCanvas.height = 64;
        const sCtx = barrierStripeCanvas.getContext('2d');
        sCtx.fillStyle = '#0f172a';
        sCtx.fillRect(0, 0, 256, 64);
        sCtx.fillStyle = '#00e5ff'; // Cyan neon chevron
        for (let x = 0; x < 256; x += 32) {
            sCtx.beginPath();
            sCtx.moveTo(x, 0);
            sCtx.lineTo(x + 16, 32);
            sCtx.lineTo(x, 64);
            sCtx.lineTo(x + 10, 64);
            sCtx.lineTo(x + 26, 32);
            sCtx.lineTo(x + 10, 0);
            sCtx.fill();
        }
        const barrierTex = new THREE.CanvasTexture(barrierStripeCanvas);
        barrierTex.wrapS = THREE.RepeatWrapping;
        barrierTex.repeat.set(80, 1);
        const neonBarrierMat = new THREE.MeshBasicMaterial({ map: barrierTex });

        // Build curbs along track
        const curbGeomLeft = new THREE.BufferGeometry();
        const curbGeomRight = new THREE.BufferGeometry();
        const leftPositions = [];
        const rightPositions = [];
        const leftIndices = [];
        const rightIndices = [];
        const leftUvs = [];
        const rightUvs = [];

        for (let i = 0; i <= segments; i++) {
            const pt = this.samplePoints[i];
            const norm = this.sampleNormals[i];
            const v = (i / segments) * 200;

            // Left curb
            const lInnerX = pt.x - norm.x * halfWidth;
            const lInnerZ = pt.z - norm.z * halfWidth;
            const lOuterX = pt.x - norm.x * (halfWidth + curbWidth);
            const lOuterZ = pt.z - norm.z * (halfWidth + curbWidth);

            leftPositions.push(lInnerX, pt.y + 0.08, lInnerZ);
            leftPositions.push(lOuterX, pt.y + 0.15, lOuterZ);
            leftUvs.push(0, v, 1, v);

            // Right curb
            const rInnerX = pt.x + norm.x * halfWidth;
            const rInnerZ = pt.z + norm.z * halfWidth;
            const rOuterX = pt.x + norm.x * (halfWidth + curbWidth);
            const rOuterZ = pt.z + norm.z * (halfWidth + curbWidth);

            rightPositions.push(rInnerX, pt.y + 0.08, rInnerZ);
            rightPositions.push(rOuterX, pt.y + 0.15, rOuterZ);
            rightUvs.push(0, v, 1, v);

            if (i < segments) {
                const idx = i * 2;
                leftIndices.push(idx, idx + 1, idx + 2);
                leftIndices.push(idx + 1, idx + 3, idx + 2);
                rightIndices.push(idx, idx + 1, idx + 2);
                rightIndices.push(idx + 1, idx + 3, idx + 2);
            }
        }

        curbGeomLeft.setAttribute('position', new THREE.Float32BufferAttribute(leftPositions, 3));
        curbGeomLeft.setAttribute('uv', new THREE.Float32BufferAttribute(leftUvs, 2));
        curbGeomLeft.setIndex(leftIndices);
        curbGeomLeft.computeVertexNormals();

        curbGeomRight.setAttribute('position', new THREE.Float32BufferAttribute(rightPositions, 3));
        curbGeomRight.setAttribute('uv', new THREE.Float32BufferAttribute(rightUvs, 2));
        curbGeomRight.setIndex(rightIndices);
        curbGeomRight.computeVertexNormals();

        this.scene.add(new THREE.Mesh(curbGeomLeft, curbMat));
        this.scene.add(new THREE.Mesh(curbGeomRight, curbMat));

        // Continuous Guardrail Wall along both left and right edges of the track
        const barrierDist = halfWidth + curbWidth + 0.1; // 13.9 units from centerline
        const barrierHeight = 1.8; // 1.8 meters high

        // Wall materials
        const wallMat = new THREE.MeshStandardMaterial({
            color: 0x1e293b,
            metalness: 0.85,
            roughness: 0.3
        });

        const neonRailMat = new THREE.MeshBasicMaterial({
            color: 0x00e5ff
        });

        const postMat = new THREE.MeshStandardMaterial({
            color: 0x0f172a,
            metalness: 0.9,
            roughness: 0.2
        });

        [-1, 1].forEach(side => {
            const wallGeom = new THREE.BufferGeometry();
            const railGeom = new THREE.BufferGeometry();
            const wallPos = [];
            const wallNorms = [];
            const wallIndices = [];
            const railPos = [];
            const railIndices = [];

            for (let i = 0; i <= segments; i++) {
                const pt = this.samplePoints[i];
                const norm = this.sampleNormals[i];

                const bx = pt.x + norm.x * (barrierDist * side);
                const bz = pt.z + norm.z * (barrierDist * side);
                const by = pt.y;

                // Wall bottom and top vertices
                wallPos.push(bx, by + 0.05, bz);
                wallPos.push(bx, by + barrierHeight, bz);

                // Normal points inward towards track center
                wallNorms.push(-norm.x * side, 0, -norm.z * side);
                wallNorms.push(-norm.x * side, 0, -norm.z * side);

                // Neon glowing top rail strip
                railPos.push(bx, by + barrierHeight - 0.15, bz);
                railPos.push(bx, by + barrierHeight + 0.05, bz);

                if (i < segments) {
                    const idx = i * 2;
                    // Two-sided quad for wall
                    wallIndices.push(idx, idx + 1, idx + 2);
                    wallIndices.push(idx + 1, idx + 3, idx + 2);
                    wallIndices.push(idx, idx + 2, idx + 1);
                    wallIndices.push(idx + 1, idx + 2, idx + 3);

                    railIndices.push(idx, idx + 1, idx + 2);
                    railIndices.push(idx + 1, idx + 3, idx + 2);
                    railIndices.push(idx, idx + 2, idx + 1);
                    railIndices.push(idx + 1, idx + 2, idx + 3);
                }

                // Sturdy vertical support posts every 6 segments
                if (i % 6 === 0) {
                    const post = new THREE.Mesh(
                        new THREE.CylinderGeometry(0.25, 0.25, barrierHeight + 0.4, 8),
                        postMat
                    );
                    post.position.set(bx + norm.x * (0.2 * side), by + (barrierHeight + 0.4) / 2, bz + norm.z * (0.2 * side));
                    post.castShadow = true;
                    this.scene.add(post);
                }

                // Warning chevron boards on corners
                if (i % 24 === 0) {
                    const tan = this.sampleTangents[i];
                    const chevronMesh = new THREE.Mesh(
                        new THREE.BoxGeometry(0.3, barrierHeight * 0.8, 4.0),
                        neonBarrierMat
                    );
                    chevronMesh.position.set(bx, by + barrierHeight / 2, bz);
                    chevronMesh.rotation.y = Math.atan2(tan.x, tan.z);
                    this.scene.add(chevronMesh);
                }
            }

            wallGeom.setAttribute('position', new THREE.Float32BufferAttribute(wallPos, 3));
            wallGeom.setAttribute('normal', new THREE.Float32BufferAttribute(wallNorms, 3));
            wallGeom.setIndex(wallIndices);

            railGeom.setAttribute('position', new THREE.Float32BufferAttribute(railPos, 3));
            railGeom.setIndex(railIndices);
            railGeom.computeVertexNormals();

            const wallMesh = new THREE.Mesh(wallGeom, wallMat);
            wallMesh.castShadow = true;
            wallMesh.receiveShadow = true;
            this.scene.add(wallMesh);
            this.barriers.push(wallMesh);

            const railMesh = new THREE.Mesh(railGeom, neonRailMat);
            this.scene.add(railMesh);
        });
    }

    _buildFinishArch() {
        const startPt = this.samplePoints[0];
        const startTan = this.sampleTangents[0];
        const startNorm = this.sampleNormals[0];

        const group = new THREE.Group();
        const archWidth = this.trackWidth + 6;
        const archHeight = 12;

        // Pillars
        const pillarMat = new THREE.MeshStandardMaterial({ color: 0x1a2332, metalness: 0.8, roughness: 0.2 });
        const leftPillar = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, archHeight, 16), pillarMat);
        leftPillar.position.set(-archWidth / 2, archHeight / 2, 0);
        group.add(leftPillar);

        const rightPillar = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, archHeight, 16), pillarMat);
        rightPillar.position.set(archWidth / 2, archHeight / 2, 0);
        group.add(rightPillar);

        // Cross beam truss
        const truss = new THREE.Mesh(new THREE.BoxGeometry(archWidth + 2, 2.2, 2.2), pillarMat);
        truss.position.set(0, archHeight, 0);
        group.add(truss);

        // Sign board canvas
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#05070e';
        ctx.fillRect(0, 0, 1024, 256);

        // Glowing border
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth = 12;
        ctx.strokeRect(10, 10, 1004, 236);

        ctx.fillStyle = '#00e5ff';
        ctx.font = 'bold 72px "Segoe UI", Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('⚡ SPEED RACER GP ⚡', 512, 110);

        ctx.fillStyle = '#ff0055';
        ctx.font = 'bold 52px "Segoe UI", Arial, sans-serif';
        ctx.fillText('START / FINISH', 512, 195);

        const signTex = new THREE.CanvasTexture(canvas);
        const signMesh = new THREE.Mesh(
            new THREE.PlaneGeometry(archWidth - 2, 3),
            new THREE.MeshBasicMaterial({ map: signTex })
        );
        signMesh.position.set(0, archHeight - 0.5, 1.15);
        group.add(signMesh);

        // Backside of sign
        const backSign = signMesh.clone();
        backSign.rotation.y = Math.PI;
        backSign.position.z = -1.15;
        group.add(backSign);

        // Align group with track orientation
        group.position.set(startPt.x, startPt.y, startPt.z);
        const angle = Math.atan2(startTan.x, startTan.z);
        group.rotation.y = angle;

        this.scene.add(group);
    }

    _buildGrandstands() {
        const grandstandMat = new THREE.MeshStandardMaterial({ color: 0x242d3d, roughness: 0.5 });
        const roofMat = new THREE.MeshStandardMaterial({ color: 0x00e5ff, metalness: 0.6, roughness: 0.3 });

        // Place grandstands on both sides of the start straightaway
        [-1, 1].forEach(side => {
            for (let k = 40; k <= 220; k += 60) {
                const pt = new THREE.Vector3(side * (this.trackWidth / 2 + 14), 0, k);
                const gGroup = new THREE.Group();

                // 4 tiered bleacher steps
                for (let step = 0; step < 5; step++) {
                    const stepMesh = new THREE.Mesh(
                        new THREE.BoxGeometry(50, 1.2 * (step + 1), 3),
                        grandstandMat
                    );
                    stepMesh.position.set(0, (1.2 * (step + 1)) / 2, (step - 2) * 3);
                    gGroup.add(stepMesh);

                    // Add colorful crowd spectators (little cubes)
                    for (let c = -22; c <= 22; c += 2.5) {
                        const crowdColor = [0xff1744, 0x00e5ff, 0xffea00, 0x76ff03, 0xffffff, 0xd500f9][Math.floor(Math.random() * 6)];
                        const crowdCube = new THREE.Mesh(
                            new THREE.BoxGeometry(1.2, 1.4, 1.2),
                            new THREE.MeshBasicMaterial({ color: crowdColor })
                        );
                        crowdCube.position.set(c + (Math.random() - 0.5) * 0.8, 1.2 * (step + 1) + 0.7, (step - 2) * 3);
                        gGroup.add(crowdCube);
                    }
                }

                // Cantilever canopy roof
                const roof = new THREE.Mesh(new THREE.BoxGeometry(52, 0.6, 20), roofMat);
                roof.position.set(0, 11, 0);
                roof.rotation.x = side * 0.15;
                gGroup.add(roof);

                gGroup.position.copy(pt);
                if (side < 0) {
                    gGroup.rotation.y = Math.PI;
                }
                this.scene.add(gGroup);
            }
        });
    }

    _buildFloodlights() {
        const poleMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.9, roughness: 0.2 });
        const lightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

        for (let i = 20; i < this.pointsCount; i += 40) {
            const pt = this.samplePoints[i];
            const norm = this.sampleNormals[i];
            const tan = this.sampleTangents[i];

            const poleSide = (i % 80 === 0) ? 1 : -1;
            const poleX = pt.x + norm.x * ((this.trackWidth / 2 + 8) * poleSide);
            const poleZ = pt.z + norm.z * ((this.trackWidth / 2 + 8) * poleSide);

            const pole = new THREE.Group();
            const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.7, 18, 12), poleMat);
            mast.position.y = 9;
            pole.add(mast);

            // Light head angled at track
            const head = new THREE.Mesh(new THREE.BoxGeometry(4.5, 1.5, 2), poleMat);
            head.position.set(0, 18, 0);
            pole.add(head);

            // 4 bright emissive light lamps
            for (let lx = -1.5; lx <= 1.5; lx += 1.0) {
                const lamp = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), lightMat);
                lamp.position.set(lx, 17.8, -poleSide * 1.05);
                lamp.rotation.x = Math.PI / 4;
                if (poleSide < 0) lamp.rotation.y = Math.PI;
                pole.add(lamp);
            }

            pole.position.set(poleX, pt.y, poleZ);
            pole.rotation.y = Math.atan2(tan.x, tan.z);
            this.scene.add(pole);
        }
    }

    _buildBillboards() {
        const billboardAds = [
            { text: 'TURBO NOS ⚡ BOOST', sub: 'PURE ADRENALINE', color: '#ff0055' },
            { text: 'APEX MOTORS 🏁', sub: 'PRECISION RACING', color: '#00e5ff' },
            { text: 'CYBER DRIFT 99', sub: 'NEVER LIFT', color: '#ffcc00' },
            { text: 'HYPERION TIRES', sub: 'MAXIMUM TRACTION', color: '#76ff03' },
            { text: 'OCTANE 105', sub: 'ULTRA PERFORMANCE', color: '#d500f9' }
        ];

        let adIdx = 0;
        for (let i = 35; i < this.pointsCount; i += 70) {
            const pt = this.samplePoints[i];
            const norm = this.sampleNormals[i];
            const tan = this.sampleTangents[i];

            const side = (adIdx % 2 === 0) ? 1 : -1;
            const ad = billboardAds[adIdx % billboardAds.length];
            adIdx++;

            const bbX = pt.x + norm.x * ((this.trackWidth / 2 + 12) * side);
            const bbZ = pt.z + norm.z * ((this.trackWidth / 2 + 12) * side);

            const canvas = document.createElement('canvas');
            canvas.width = 512;
            canvas.height = 256;
            const ctx = canvas.getContext('2d');

            ctx.fillStyle = '#080a14';
            ctx.fillRect(0, 0, 512, 256);

            ctx.strokeStyle = ad.color;
            ctx.lineWidth = 10;
            ctx.strokeRect(10, 10, 492, 236);

            ctx.fillStyle = ad.color;
            ctx.font = 'bold 44px "Segoe UI", Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(ad.text, 256, 115);

            ctx.fillStyle = '#ffffff';
            ctx.font = '26px "Segoe UI", Arial, sans-serif';
            ctx.fillText(ad.sub, 256, 175);

            const bbTex = new THREE.CanvasTexture(canvas);
            const group = new THREE.Group();

            const frame = new THREE.Mesh(
                new THREE.BoxGeometry(16, 8, 0.8),
                new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8 })
            );
            frame.position.y = 8;
            group.add(frame);

            const adFace = new THREE.Mesh(
                new THREE.PlaneGeometry(15.4, 7.4),
                new THREE.MeshBasicMaterial({ map: bbTex })
            );
            adFace.position.set(0, 8, side > 0 ? -0.45 : 0.45);
            if (side > 0) adFace.rotation.y = Math.PI;
            group.add(adFace);

            // Support legs
            const legMat = new THREE.MeshStandardMaterial({ color: 0x334155 });
            const leg1 = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 8), legMat);
            leg1.position.set(-6, 4, 0);
            const leg2 = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 8), legMat);
            leg2.position.set(6, 4, 0);
            group.add(leg1);
            group.add(leg2);

            group.position.set(bbX, pt.y, bbZ);
            group.rotation.y = Math.atan2(tan.x, tan.z) + (side > 0 ? 0.3 : -0.3);
            this.scene.add(group);
        }
    }

    _buildScenery() {
        // Vast terrain / ground plane with lush futuristic cyber-grass grid
        const groundGeom = new THREE.PlaneGeometry(2400, 2400, 60, 60);
        groundGeom.rotateX(-Math.PI / 2);

        // Add gentle undulating hills to ground terrain
        const pos = groundGeom.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            const z = pos.getZ(i);
            // Don't raise ground near the track
            const dist = Math.sqrt(x * x + z * z);
            if (dist > 300) {
                const h = (Math.sin(x * 0.008) * Math.cos(z * 0.008) * 35) +
                          (Math.sin(x * 0.02) * Math.cos(z * 0.02) * 12);
                pos.setY(i, Math.max(-5, h));
            }
        }
        groundGeom.computeVertexNormals();

        const groundMat = new THREE.MeshStandardMaterial({
            color: 0x0f1d18, // Dark futuristic forest green
            roughness: 0.9,
            metalness: 0.05
        });
        const groundMesh = new THREE.Mesh(groundGeom, groundMat);
        groundMesh.position.y = -0.4;
        groundMesh.receiveShadow = true;
        this.scene.add(groundMesh);

        // Low-poly stylized trees & pines in the infield and outfield
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.9 });
        const pineMat = new THREE.MeshStandardMaterial({ color: 0x1b5e20, roughness: 0.8 });
        const pineMat2 = new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.8 });

        const treeGeom = new THREE.ConeGeometry(3.5, 9, 6);
        const trunkGeom = new THREE.CylinderGeometry(0.6, 0.8, 3, 6);

        for (let t = 0; t < 180; t++) {
            const randAngle = Math.random() * Math.PI * 2;
            const randDist = 80 + Math.random() * 650;
            const tx = Math.cos(randAngle) * randDist + 200;
            const tz = Math.sin(randAngle) * randDist;

            // Check if too close to track
            let tooClose = false;
            for (let i = 0; i < this.samplePoints.length; i += 10) {
                const spt = this.samplePoints[i];
                const d = Math.hypot(tx - spt.x, tz - spt.z);
                if (d < this.trackWidth / 2 + 15) {
                    tooClose = true;
                    break;
                }
            }
            if (tooClose) continue;

            const treeGroup = new THREE.Group();
            const trunk = new THREE.Mesh(trunkGeom, trunkMat);
            trunk.position.y = 1.5;
            treeGroup.add(trunk);

            const foliage = new THREE.Mesh(treeGeom, (t % 2 === 0) ? pineMat : pineMat2);
            foliage.position.y = 7;
            foliage.scale.set(1 + Math.random() * 0.5, 1 + Math.random() * 0.6, 1 + Math.random() * 0.5);
            treeGroup.add(foliage);

            treeGroup.position.set(tx, 0, tz);
            this.scene.add(treeGroup);
        }

        // Distance mountain ring
        const mountainGeom = new THREE.ConeGeometry(120, 240, 5);
        const mountainMat = new THREE.MeshStandardMaterial({
            color: 0x131d2e,
            roughness: 0.9,
            flatShading: true
        });

        for (let m = 0; m < 20; m++) {
            const angle = (m / 20) * Math.PI * 2;
            const dist = 1100 + (Math.sin(m * 2) * 150);
            const mMesh = new THREE.Mesh(mountainGeom, mountainMat);
            mMesh.position.set(
                Math.cos(angle) * dist,
                100,
                Math.sin(angle) * dist
            );
            mMesh.scale.set(1 + Math.random() * 0.8, 0.8 + Math.random() * 0.5, 1 + Math.random() * 0.8);
            this.scene.add(mMesh);
        }
    }

    /**
     * Given any world position (x, y, z), finds the closest track parameter t in [0, 1],
     * lateral offset (meters left/right from center line), and distance along track.
     */
    findClosestTrackPoint(pos) {
        let minDistSq = Infinity;
        let closestIdx = 0;

        // Sample search
        const step = 2;
        for (let i = 0; i < this.samplePoints.length; i += step) {
            const spt = this.samplePoints[i];
            const dx = pos.x - spt.x;
            const dz = pos.z - spt.z;
            const distSq = dx * dx + dz * dz;
            if (distSq < minDistSq) {
                minDistSq = distSq;
                closestIdx = i;
            }
        }

        // Refine around closestIdx
        const low = Math.max(0, closestIdx - 3);
        const high = Math.min(this.samplePoints.length - 1, closestIdx + 3);
        for (let i = low; i <= high; i++) {
            const spt = this.samplePoints[i];
            const dx = pos.x - spt.x;
            const dz = pos.z - spt.z;
            const distSq = dx * dx + dz * dz;
            if (distSq < minDistSq) {
                minDistSq = distSq;
                closestIdx = i;
            }
        }

        const t = closestIdx / this.pointsCount;
        const pt = this.samplePoints[closestIdx];
        const norm = this.sampleNormals[closestIdx];
        const tan = this.sampleTangents[closestIdx];

        // Signed lateral distance: positive = right, negative = left
        const toPos = new THREE.Vector3(pos.x - pt.x, 0, pos.z - pt.z);
        const lateralOffset = toPos.dot(norm);

        return {
            t: t,
            point: pt,
            tangent: tan,
            normal: norm,
            lateralOffset: lateralOffset,
            distanceAlongTrack: this.sampleDistances[closestIdx],
            totalLength: this.trackLength,
            isOffTrack: Math.abs(lateralOffset) > (this.trackWidth / 2)
        };
    }

    getPointAt(t) {
        return this.curve.getPointAt((t % 1 + 1) % 1);
    }

    getTangentAt(t) {
        return this.curve.getTangentAt((t % 1 + 1) % 1).normalize();
    }
}

window.RaceTrack = RaceTrack;

