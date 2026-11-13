# 🏁 SPEED RACER GP 3D

An exhilarating, high-octane 3D arcade racing game with **multiple intelligent CPU opponents**, **procedural synthwave background music**, and **satisfying drift & nitro physics**.

Built with WebGL / Three.js and the Web Audio API — runs seamlessly in any modern web browser with **zero external sound assets or install friction**.

---

## 🎮 How to Play

### Option 1: Instant Launch (Double Click)
- Double click **`start_game.bat`** or double click **`index.html`** in your file manager to play immediately in your default browser!

### Option 2: Local Server via Node.js
Open your terminal in this directory and run:
```bash
npm start
```
Then visit [http://localhost:3000](http://localhost:3000) in Chrome, Edge, Firefox, or Safari.

---

## 🏎️ Controls

| Action | Keyboard | Touch Controls |
| :--- | :--- | :--- |
| **Accelerate** | `W` or `↑` | ▲ Gas button |
| **Brake / Reverse** | `S` or `↓` | 🛑 Brake button |
| **Steer Left / Right**| `A` / `D` or `←` / `→` | ◀ / ▶ Directional buttons |
| **Handbrake Drift** | `Spacebar` | 💨 Drift button |
| **Nitro (NOS) Boost** | `Left Shift` / `Right Shift` | ⚡ Nitro button |
| **Switch Camera Mode**| `C` | 🎥 Camera HUD button |
| **Reset Car to Track**| `R` | 🔄 Reset HUD button |
| **Mute / Unmute Audio**| `M` | 🔊 Audio Mute icon |
| **Pause / Resume Game** | `ESC` or `P` | ⏸ Pause button (HUD & Touch) |

---

## 🌟 Key Features

### 1. Multiple CPU Opponents
Race against **5 distinct CPU AI competitors** with unique car designs, colors, and driving personalities:
- 🔴 **Viper** (#7 Crimson Hypercar): Aggressive overtaker, pushes top speed, attacks apexes.
- ⚫ **Shadow** (#13 Stealth Charcoal & Gold): Ultra-clean racing line, smooth braking, hard to pass.
- 🟠 **Blaze** (#24 Sunset Flame): Fast launch, frequent nitro bursts on straights, drafts behind leaders.
- 🟢 **Apex** (#88 Acid Lime): Cornering master, brakes late, drifts chicanes with ease.
- 🟣 **Thunder** (#99 Royal Purple): Heavy momentum GT, holds lane firmly with high acceleration.

**AI Capabilities**:
- Real-time waypoint navigation on 3D spline track.
- Lookahead corner curvature detection with intelligent braking for hairpins and chicanes.
- Radar obstacle detection: searches for open lanes and executes clean overtaking maneuvers.
- Tactical Nitro boosts on long straightaways.
- Elastic bumper collisions with impact audio and spark feedback.

### 2. Built-in Procedural Background Music & SFX
Powered 100% by the **Web Audio API** — zero missing files, zero CORS errors, zero buffering:
- **3 Selectable High-Energy Soundtracks**:
  1. *Neon Highway* (128 BPM Synthwave)
  2. *Cyber Drift* (138 BPM High-Energy Eurobeat)
  3. *Turbo Overdrive* (130 BPM Arcade Electro)
- Interactive Music Player in the top HUD:
  - Play / Pause
  - Skip Track (`⏭`)
  - Independent Music and SFX volume sliders
  - Master Mute toggle (`M`)
- **Procedural Sound Effects (SFX)**:
  - Dual-oscillator engine synth with dynamic RPM pitch tracking and gear shifts (1st through 5th gear).
  - Resonant bandpass tire screech when drifting.
  - Frequency-swept Nitro boost whoosh.
  - Crash / collision impact sounds.
  - Race countdown beeps (3... 2... 1... GO!) and lap completion fanfare!

### 3. Dynamic Arcade Vehicle Physics
- Speed-sensitive steering with natural auto-centering.
- Handbrake drift mechanics: kick out the rear wheels, counter-steer through corners, generate tire smoke particles, and leave skid marks on the road!
- Drifting and drafting recharge your Nitro meter faster!
- Dynamic suspension roll (body leans into turns, dips during heavy braking, and squats under full throttle).
- 4 selectable camera angles (Chase Cam, Close Arcade Bumper Cam, Cockpit/Hood Cam, Helicopter Drone Cam).

### 4. Grand Prix Circuit & Cyber Atmosphere
- Banked high-speed turns, chicane S-curves, hairpins, and elevation changes.
- Checkered start/finish line gantry with digital display.
- Dual grandstands with animated multi-colored spectators.
- Stadium floodlights, illuminated cyberpunk sponsor billboards, and perimeter mountains.
- Real-time radar Mini-Map showing player position and all 5 CPU opponents in live action!

### 5. Lap Progression & Race Distance Options
- **Automatic Next Lap Transition**: Every time your car completes a loop around the circuit and passes under the finish line gantry, the game instantly changes to the **NEXT LAP** (e.g. `LAP 1 / 3` ➔ `LAP 2 / 3` ➔ `LAP 3 / 3` ➔ Finish)!
- **Dual Finish Line Detection**: Combines 3D coordinate plane crossing ($z < 0 \to z \ge 0$ under the gantry) with spline curve wrap ($t: 0.99 \to 0.01$) alongside halfway checkpoint validation ($t \in [0.35, 0.75]$) so passing the finish line triggers every time without fail.
- **Neon HUD Lap Flash**: Upon crossing the finish line, the HUD lap counter visually pulses with electric neon cyan/green scaling (`lap-pulse`) and plays a celebratory chime.
- **Race Distance Selector**:
  - **3 LAPS (Standard - Default)**: Full 3-lap Grand Prix race with lap transitions and final lap showdown.
  - **1 LAP (Sprint)**: High-speed single lap dash to the finish line.
  - **5 LAPS (Endurance)**: Extended race testing endurance, tire management, and nitro timing.
- **Lap Splits & Celebrations**: Flashes split times on each lap crossing, displays `⚡ NEW BEST!` for record-setting laps, and provides a final podium standings table (Best Lap + Total Time).

