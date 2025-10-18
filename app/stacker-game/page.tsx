"use client";

import { useEffect, useRef } from "react";

export default function StackerGamePage() {
	const gameContainerRef = useRef<HTMLDivElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const bgMusicRef = useRef<HTMLAudioElement>(null);
	const placeBlockSoundRef = useRef<HTMLAudioElement>(null);
	const gameOverSoundRef = useRef<HTMLAudioElement>(null);
	const dropNowRef = useRef<(() => void) | null>(null);

	const handleDropButtonClick = () => {
		if (dropNowRef.current) {
			dropNowRef.current();
			return;
		}
		// Fallback: simulate spacebar
		const spaceEvent = new KeyboardEvent("keydown", { code: "Space", key: " ", keyCode: 32, bubbles: true });
		window.dispatchEvent(spaceEvent);
	};

	useEffect(() => {
		if (typeof window === "undefined") return;

		// Particle class
		class Particle {
			x: number;
			y: number;
			color: string;
			size: number;
			speedX: number;
			speedY: number;
			gravity: number;
			life: number;
			maxLife: number;
			glowStrength: number;

			constructor(x: number, y: number, color: string) {
				this.x = x;
				this.y = y + y * 0.1;
				this.color = color;
				this.size = Math.random() * 2 + 1;
				this.speedX = Math.random() * 20 - 10;
				this.speedY = Math.random() * -2 - 1;
				this.gravity = 0.125;
				this.life = 100;
				this.maxLife = 100;
				this.glowStrength = 5;
			}

			update() {
				this.x += this.speedX;
				this.y += this.speedY;
				this.speedY += this.gravity;
				this.life--;
				this.glowStrength = Math.max(0, this.glowStrength - 0.1);
				this.speedX *= 0.98;
			}

			draw(ctx: CanvasRenderingContext2D) {
				ctx.save();
				ctx.globalAlpha = this.life / this.maxLife;
				ctx.fillStyle = this.color;
				ctx.shadowColor = this.color;
				ctx.shadowBlur = 10 * this.glowStrength;
				ctx.beginPath();
				ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
				ctx.fill();
				ctx.restore();
			}
		}

		// ParticleSystem class
		class ParticleSystem {
			canvas: HTMLCanvasElement;
			ctx: CanvasRenderingContext2D;
			particles: Particle[];

			constructor(canvas: HTMLCanvasElement) {
				this.canvas = canvas;
				this.ctx = canvas.getContext("2d")!;
				this.particles = [];
			}

			addParticles(x: number, y: number, color: string, amount: number) {
				for (let i = 0; i < amount; i++) {
					this.particles.push(new Particle(x, y, color));
				}
			}

			update() {
				this.particles = this.particles.filter((p) => p.life > 0);
				this.particles.forEach((p) => p.update());
			}

			draw() {
				this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
				this.particles.forEach((p) => p.draw(this.ctx));
			}
		}

		// StackerGame class
		class StackerGame {
			BOARD_WIDTH = 11;
			BOARD_HEIGHT = 14;
			LIMIT_3 = 3;
			LIMIT_2 = 8;
			MIN_SPEED = 4 / 64;
			MAX_SPEED = 1.5 / 64;
			ANIMATION_TIME = 0.75 * 60;

			gameElement: HTMLDivElement;
			gameBoard: HTMLTableElement | null = null;
			board: number[][];
			blocks = 3;
			running = false;
			level = 0;
			pos: number;
			left = true;
			timer = 0;
			atimer = 0;
			// Brand orange gradient for all rows
			colorGradient = new Array(15).fill("#FA4616");
			particleSystem: ParticleSystem | null = null;
			gamesPlayed = 0;
			gamesWon = 0;
			winStreak = 0;
			startTime = 0;
			timerInterval: NodeJS.Timeout | null = null;
			fastestWin = Infinity;
			gameOver = false;
			gameOverAnimation = false;
			quickRestart = false;
			gameOverAnimationTimer: NodeJS.Timeout | null = null;

			constructor(gameElement: HTMLDivElement) {
				this.gameElement = gameElement;
				this.board = new Array(this.BOARD_HEIGHT);
				for (let i = 0; i < this.BOARD_HEIGHT; i++) {
					this.board[i] = new Array(this.BOARD_WIDTH).fill(0);
				}
				this.pos =
					Math.floor(this.BOARD_WIDTH / 2) - Math.floor(this.blocks / 2);
			}

			buildHTML() {
				const domTable = document.createElement("table");
				for (let i = 0; i < this.BOARD_HEIGHT; i++) {
					const domTableRow = domTable.insertRow(i);
					for (let j = 0; j < this.BOARD_WIDTH; j++) {
						domTableRow.insertCell(j);
					}
				}
				this.gameBoard = domTable;
				this.gameElement.appendChild(this.gameBoard);

				const canvas = canvasRef.current;
				if (canvas) {
					canvas.width = this.gameElement.offsetWidth;
					canvas.height = this.gameElement.offsetHeight;
					this.particleSystem = new ParticleSystem(canvas);
				}
			}

			run() {
				setInterval(() => {
					this.onStep();
					this.particleSystem?.update();
					this.particleSystem?.draw();
				}, 1000 / 60);
				window.addEventListener("keydown", (e) => this.onKeyPress(e));
				// Low-latency click/touch handlers
				this.gameElement.addEventListener("pointerdown", (e) => {
					// Trigger drop immediately on pointerdown to reduce perceived latency
					if (this.running) {
						this.onSpacePress();
					} else {
						this.onEnterPress();
					}
					e.preventDefault();
				}, { passive: false });
				this.gameElement.addEventListener("click", (e) => this.onClick(e));
			}

			onStep() {
				if (this.atimer > 0) {
					this.atimer--;
				}

				if (this.atimer === 0) {
					for (let i = 0; i < this.BOARD_HEIGHT; i++) {
						for (let j = 0; j < this.BOARD_WIDTH; j++) {
							if (this.board[i][j] === 2) {
								this.board[i][j] = 0;
							}
						}
					}

					if (this.blocks === 0) {
						if (this.running) {
							this.running = false;
							const gameOverSound = gameOverSoundRef.current;
							if (gameOverSound) {
								gameOverSound.volume = 1.0;
								gameOverSound.play();
							}
							this.showGameOverMessage("REKT", "#ff00de");
						}
					}
				}

				if (this.running && this.atimer === 0) {
					if (this.timer <= 0) {
						if (this.left) {
							this.pos--;
							if (this.pos + this.blocks - 1 === 0) {
								this.left = false;
							}
						} else {
							this.pos++;
							if (this.pos === this.BOARD_WIDTH - 1) {
								this.left = true;
							}
						}
						this.timer =
							(this.MAX_SPEED +
								(this.MIN_SPEED - this.MAX_SPEED) *
									(1 - this.level / this.BOARD_HEIGHT)) *
							60;
					} else {
						this.timer--;
					}
				}

				this.render();
			}

			render() {
				if (!this.gameBoard) return;

				for (let i = 0; i < this.BOARD_HEIGHT; i++) {
					for (let j = 0; j < this.BOARD_WIDTH; j++) {
						const cell =
							this.gameBoard.rows[this.BOARD_HEIGHT - 1 - i].cells[j];
						if (this.board[i][j] === 1) {
							cell.className = i % 2 === 0 ? "filled-1" : "filled-2";
							cell.style.backgroundColor = this.colorGradient[i];
					} else if (this.board[i][j] === 2 && this.atimer > 0) {
						// Mark misplaced blocks as falling with animation
						const baseClass = i % 2 === 0 ? "filled-1" : "filled-2";
						cell.className = baseClass + " falling";
						cell.style.backgroundColor = this.colorGradient[i];
					} else {
							cell.className = "";
							cell.style.backgroundColor = "";
						}
					}
				}

				if (this.running && this.atimer === 0) {
					for (let j = this.pos; j < this.pos + this.blocks; j++) {
						if (j >= 0 && j < this.BOARD_WIDTH) {
							const cell =
								this.gameBoard.rows[this.BOARD_HEIGHT - 1 - this.level].cells[
									j
								];
							cell.className = this.level % 2 === 0 ? "filled-1" : "filled-2";
							cell.style.backgroundColor = this.colorGradient[this.level];
						}
					}
				}
			}

			onKeyPress(e: KeyboardEvent) {
				if (e.code === "Space") {
					this.onSpacePress();
					e.preventDefault();
				} else if (e.code === "Enter") {
					this.onEnterPress();
					e.preventDefault();
				}
			}

			onClick(e: MouseEvent) {
				if (this.running) {
					this.onSpacePress();
				} else {
					this.onEnterPress();
				}
				e.preventDefault();
			}

			onSpacePress() {
				if (!this.running) {
					this.onEnterPress();
				} else if (this.atimer === 0) {
					const blockCount = this.blocks;
					let misplacedBlocks = false;

					if (this.level > 0) {
						for (let i = this.pos; i < this.pos + this.blocks; i++) {
							if (i >= 0 && i < this.BOARD_WIDTH) {
								if (this.board[this.level - 1][i] === 0) {
									this.blocks--;
									misplacedBlocks = true;
								}
							}
						}
					}

					for (let i = this.pos; i < this.pos + blockCount; i++) {
						if (i >= 0 && i < this.BOARD_WIDTH) {
							if (this.level > 0 && this.board[this.level - 1][i] === 0) {
								this.board[this.level][i] = 2;
								this.atimer = this.ANIMATION_TIME;
							} else {
								this.board[this.level][i] = 1;
							}
						}
					}

					if (this.blocks <= 0) {
						this.running = false;
						this.gamesPlayed++;
						this.winStreak = 0;
						this.updateStats();
						this.stopTimer();
						this.showGameOverMessage("REKT", "#ff00de");
						return;
					}

					if (this.level === this.BOARD_HEIGHT - 1) {
						this.running = false;
						this.gamesPlayed++;
						this.gamesWon++;
						this.winStreak++;
						this.updateStats();
						this.stopTimer();
						this.updateFastestWin();
						this.showGameOverMessage("YOU WIN!", "#ff00de");
					} else if (this.blocks > 0) {
						this.level++;
						this.pos =
							Math.floor(this.BOARD_WIDTH / 2) - Math.floor(this.blocks / 2);

						if (this.level === this.LIMIT_3) {
							this.blocks = Math.min(this.blocks, 2);
						}
						if (this.level === this.LIMIT_2) {
							this.blocks = 1;
						}
					}
				}
			}

			onEnterPress() {
				if (this.gameOverAnimation) {
					this.quickRestart = true;
				}

				const bgMusic = bgMusicRef.current;
				if (bgMusic?.paused) {
					bgMusic.volume = 0.5;
					bgMusic.play();
				}

				if (!this.running || this.gameOver) {
					const startMessage = document.getElementById("start-message");
					if (startMessage) startMessage.style.display = "none";

					for (let i = 0; i < this.BOARD_HEIGHT; i++) {
						for (let j = 0; j < this.BOARD_WIDTH; j++) {
							this.board[i][j] = 0;
						}
					}

					this.level = 0;
					this.blocks = 3;
					this.pos =
						Math.floor(this.BOARD_WIDTH / 2) - Math.floor(this.blocks / 2);
					this.left = true;
					this.running = true;
					this.gameOver = false;
					this.atimer = 0;
					this.timer =
						(this.MAX_SPEED +
							(this.MIN_SPEED - this.MAX_SPEED) *
								(1 - this.level / this.BOARD_HEIGHT)) *
						60;

					this.gamesPlayed++;
					this.updateStats();

					const gameOverMessage = document.getElementById("game-over-message");
					const gameOverOverlay = document.querySelector(".game-over-overlay");
					if (gameOverMessage) gameOverMessage.style.display = "none";
					if (gameOverOverlay)
						(gameOverOverlay as HTMLElement).style.display = "none";

					this.resetTimer();
					this.startTimer();
				}
			}

			showGameOverMessage(message: string, color: string) {
				const gameOverMessage = document.getElementById("game-over-message");
				const gameOverOverlay = document.querySelector(".game-over-overlay");
				const startMessage = document.getElementById("start-message");

				if (this.gameOverAnimationTimer) {
					clearTimeout(this.gameOverAnimationTimer);
				}

				if (startMessage) {
					startMessage.style.display = "none";
					startMessage.classList.remove("fade-in");
				}

				this.gameOverAnimation = true;
				this.quickRestart = false;

				if (gameOverMessage) {
					gameOverMessage.innerHTML = "";
					gameOverMessage.style.color = color;

					message.split("").forEach((letter, index) => {
						const span = document.createElement("span");
						span.textContent = letter;
						span.classList.add("neon-letter");
						span.style.animationDelay = `${index * 0.2}s`;
						gameOverMessage.appendChild(span);
					});

					gameOverMessage.style.display = "block";
				}

				if (gameOverOverlay) {
					(gameOverOverlay as HTMLElement).style.display = "block";
				}

				this.gameOverAnimationTimer = setTimeout(() => {
					this.gameOverAnimation = false;
					if (!this.quickRestart && startMessage) {
						startMessage.style.display = "block";
						startMessage.classList.add("fade-in");
					}
				}, 3000);

				this.gameOver = true;
				this.running = false;
			}

			updateStats() {
				const gamesPlayed = document.getElementById("games-played");
				const gamesWon = document.getElementById("games-won");
				const winStreak = document.getElementById("win-streak");
				if (gamesPlayed) gamesPlayed.textContent = this.gamesPlayed.toString();
				if (gamesWon) gamesWon.textContent = this.gamesWon.toString();
				if (winStreak) winStreak.textContent = this.winStreak.toString();
			}

			updateTimer() {
				const currentTime = Date.now();
				const elapsedTime = currentTime - this.startTime;
				const minutes = Math.floor(elapsedTime / 60000)
					.toString()
					.padStart(2, "0");
				const seconds = Math.floor((elapsedTime % 60000) / 1000)
					.toString()
					.padStart(2, "0");
				const milliseconds = Math.floor((elapsedTime % 1000) / 10)
					.toString()
					.padStart(2, "0");
				const timerElement = document.getElementById("timer");
				if (timerElement)
					timerElement.textContent = `${minutes}:${seconds}.${milliseconds}`;
			}

			startTimer() {
				this.startTime = Date.now();
				this.timerInterval = setInterval(() => this.updateTimer(), 10);
			}

			stopTimer() {
				if (this.timerInterval) {
					clearInterval(this.timerInterval);
				}
			}

			resetTimer() {
				this.stopTimer();
				const timerElement = document.getElementById("timer");
				if (timerElement) timerElement.textContent = "00:00.00";
			}

			updateFastestWin() {
				const currentTime = Date.now();
				const elapsedTime = currentTime - this.startTime;
				if (elapsedTime < this.fastestWin) {
					this.fastestWin = elapsedTime;
					const minutes = Math.floor(this.fastestWin / 60000)
						.toString()
						.padStart(2, "0");
					const seconds = Math.floor((this.fastestWin % 60000) / 1000)
						.toString()
						.padStart(2, "0");
					const milliseconds = Math.floor((this.fastestWin % 1000) / 10)
						.toString()
						.padStart(2, "0");
					const fastestWinElement = document.getElementById("fastest-win");
					if (fastestWinElement)
						fastestWinElement.textContent = `${minutes}:${seconds}.${milliseconds}`;
				}
			}
		}

		// Initialize game
		if (gameContainerRef.current) {
			const game = new StackerGame(gameContainerRef.current);
			// Expose low-latency drop function for touch/button
			dropNowRef.current = () => game.onSpacePress();
			const bgMusic = bgMusicRef.current;
			if (bgMusic) {
				bgMusic.volume = 0.5;
				bgMusic.play();
			}
			game.buildHTML();
			game.run();
		}
	}, []);

	return (
		<>
			<style jsx global>{`
				body {
					background-image: url("/Mirage.jpg");
					background-size: cover;
					background-position: center;
					background-repeat: no-repeat;
					color: white;
					font-family: Arial, sans-serif;
					text-align: center;
					margin: 0;
					padding: 20px;
					overflow: hidden;
				}

				#stacker-page-container {
					background-image: url("/Mirage.jpg");
					background-size: cover;
					background-position: center;
					background-repeat: no-repeat;
					display: center;
					justify-content: center;
					align-items: center;
					min-height: 100vh;
					padding-top: 5vh;
				}

				#stacker-game {
					position: relative;
					width: 353px;
					height: 495px;
					margin: 0;
					display: flex;
					justify-content: center;
					align-items: center;
					border: 1px solid white;
				}

				#stacker-game table {
					border-spacing: 0;
					border-collapse: separate;
					width: 100%;
					height: 100%;
				}

				#stacker-game td {
					width: 27px;
					height: 27px;
					border: 1px solid #111;
					padding: 0;
					position: relative;
				}

				/* Orange glow brand color */
				.filled-1,
				.filled-2 {
					box-shadow: 0 0 10px rgba(250, 70, 22, 0.6) !important;
				}

				.filled-1 {
					background-image: url("/stacker-game/images/block.svg");
					background-size: contain;
					background-repeat: no-repeat;
					background-position: center;
				}

				.filled-2 {
					background-image: url("/stacker-game/images/block2.svg");
					background-size: contain;
					background-repeat: no-repeat;
					background-position: center;
				}

				/* Falling animation: slide down and fade out */
				@keyframes fallOff {
					0% { transform: translateY(0); opacity: 1; }
					100% { transform: translateY(120%); opacity: 0; }
				}

				.falling {
					animation: fallOff 0.5s ease-out forwards;
				}

				#game-over-message {
					display: none;
					position: absolute;
					top: 50%;
					left: 50%;
					transform: translate(-50%, -50%);
					font-family: "Poppins", sans-serif;
					font-size: 72px;
					font-weight: 700;
					color: #ff00de;
					text-align: center;
					z-index: 10;
					text-shadow: 0 0 10px rgba(255, 0, 222, 0.7),
						0 0 20px rgba(255, 0, 222, 0.5), 0 0 30px rgba(255, 0, 222, 0.3);
				}

				.neon-letter {
					opacity: 0;
					animation: flicker 2s linear forwards;
				}

				@keyframes flicker {
					0%,
					100% {
						opacity: 0;
					}
					10%,
					90% {
						opacity: 1;
					}
					20%,
					80% {
						opacity: 0.8;
					}
					30%,
					70% {
						opacity: 1;
					}
					40%,
					60% {
						opacity: 0.6;
					}
					50% {
						opacity: 1;
					}
				}

				.game-over-overlay {
					display: none;
					position: absolute;
					top: 0;
					left: 0;
					width: 100%;
					height: 100%;
					background-color: rgba(0, 0, 0, 0.7);
					z-index: 9;
				}

				.glow-row td {
					transition: box-shadow 0.3s ease-out, opacity 0.3s ease-out;
				}

				.glow-active {
					opacity: 1;
				}

				.glow-fade {
					opacity: 0;
					box-shadow: none !important;
				}

				.cell-glow {
					transition: box-shadow 0.3s ease-out;
				}

				#particle-canvas {
					position: absolute;
					top: 0;
					left: 0;
					width: 100%;
					height: 100%;
					pointer-events: none;
					z-index: 10;
				}

				/* Invisible touch layer to tap anywhere on the board to drop */
				#touch-drop-layer {
					position: absolute;
					top: 0;
					left: 0;
					width: 100%;
					height: 100%;
					background: transparent;
					z-index: 20;
					touch-action: manipulation;
				}

				#stats-board {
					position: fixed;
					top: 20px;
					right: 20px;
					background-color: rgba(0, 0, 0, 0.7);
					padding: 6px 10px;
					border-radius: 6px;
					font-family: "Poppins", sans-serif;
					font-size: 11px;
					text-align: left;
					color: #fff;
					box-shadow: 0 0 10px #FA4616, 0 0 20px #FA4616;
					animation: glow 1.5s ease-in-out infinite alternate;
					z-index: 1000;
				}

				#stats-board p {
					margin: 3px 0;
				}

				@keyframes glow {
					from {
						box-shadow: 0 0 10px #FA4616, 0 0 20px #FA4616;
					}
					to {
						box-shadow: 0 0 15px #FA4616, 0 0 25px #FA4616;
					}
				}

				#stacker-header {
					position: relative;
					display: flex;
					justify-content: center;
					margin: 0;
				}

				#stacker-header img {
					width: 388px;
					height: auto;
					filter: drop-shadow(0 0 2.5px rgba(255, 255, 255, 0.175))
						drop-shadow(0 0 5px rgba(255, 255, 255, 0.125))
						drop-shadow(0 0 7.5px rgba(255, 255, 255, 0.075));
				}

				#game-container-wrapper {
					display: flex;
					flex-direction: column;
					align-items: center;
					gap: 1px; /* 1px buffer between banner and board */
					margin-top: 35px; /* move stack block area down 35px */
				}

				@keyframes fadeIn {
					from {
						opacity: 0;
					}
					to {
						opacity: 1;
					}
				}

				#start-message {
					position: absolute;
					top: 50%;
					left: 50%;
					transform: translate(-50%, -50%);
					font-family: "Poppins", sans-serif;
					text-align: center;
					z-index: 10;
					opacity: 0;
				}

				#start-message.fade-in {
					animation: fadeIn 1s ease-in forwards;
				}

				#drop-button {
					position: fixed;
					right: 50px;
					top: 50%;
					transform: translateY(-50%);
					width: 120px;
					height: 120px;
					background: linear-gradient(135deg, #FA4616 0%, #ff6b3d 100%);
					border: 3px solid #fff;
					border-radius: 50%;
					cursor: pointer;
					display: none;
					flex-direction: column;
					align-items: center;
					justify-content: center;
					font-family: "Poppins", sans-serif;
					font-size: 18px;
					font-weight: 700;
					color: white;
					text-shadow: 0 0 5px rgba(250, 70, 22, 0.5);
					box-shadow: 0 0 10px #FA4616, 0 0 20px #FA4616;
					transition: all 0.3s ease;
					z-index: 1001;
					user-select: none;
				}

				#drop-button:hover {
					transform: translateY(-50%) scale(1.1);
					box-shadow: 0 0 15px #FA4616, 0 0 30px #FA4616;
				}

				#drop-button:active {
					transform: translateY(-50%) scale(0.95);
					box-shadow: 0 0 8px #FA4616, 0 0 15px #FA4616;
				}

				@media (max-width: 768px) {
					#drop-button {
						display: flex;
						right: 20px;
						width: 100px;
						height: 100px;
						font-size: 16px;
					}
				}
			`}</style>

			<link
				href="https://fonts.googleapis.com/css2?family=Poppins:wght@700&display=swap"
				rel="stylesheet"
			/>

			<div id="stacker-page-container">
				<div id="game-container-wrapper">
					<div id="stacker-header">
						<img
							src="/stacker-game/images/stacker_header2.png"
							alt="Stacker Header"
						/>
					</div>

					<div id="stacker-game" ref={gameContainerRef}>
						<div className="game-over-overlay" />
						<div id="game-over-message">REKT</div>
						<canvas id="particle-canvas" ref={canvasRef} />
						{/* Invisible layer to handle taps/clicks for dropping */}
						<div
							id="touch-drop-layer"
							role="button"
							aria-label="Drop Block"
							onClick={handleDropButtonClick}
							onTouchStart={handleDropButtonClick}
						/>
					</div>
				</div>

				{/*
				<div id="stats-board">
					<p>
						Games Played: <span id="games-played">0</span>
					</p>
					<p>
						Games Won: <span id="games-won">0</span>
					</p>
					<p>
						Win Streak: <span id="win-streak">0</span>
					</p>
					<p>
						Timer: <span id="timer">00:00.00</span>
					</p>
					<p>
						Fastest Win: <span id="fastest-win">--:--.--</span>
					</p>
				</div>
				*/}

				{/* DROP button removed; using invisible overlay on the board instead */}

				{/* start-message removed per request */}

				<audio
					ref={bgMusicRef}
					src="/stacker-game/audio/background.mp3"
					loop
					preload="auto"
				/>
				<audio
					ref={placeBlockSoundRef}
					src="/stacker-game/audio/place-block.mp3"
					preload="auto"
				/>
				<audio
					ref={gameOverSoundRef}
					src="/stacker-game/audio/GAME-OVER.mp3"
					preload="auto"
				/>
			</div>
		</>
	);
}

