// script.js

// 禁止圖片影片被拖曳
document.addEventListener('dragstart', (e) => {
  if (e.target.tagName === 'IMG' || e.target.tagName === 'video') {
    e.preventDefault();
  }
});

class MonsterGame {
  constructor() {
    this.bgm = document.getElementById('bgm')
    this.canvas = document.getElementById('gameCanvas')
    this.ctx = this.canvas.getContext('2d')
    this.recognizer = new DollarRecognizer()

    this.gameState = 'intro' // intro, waiting, playing, paused, gameOver
    this.lives = 5
    this.startTime = null
    this.currentTime = 0
    this.timerInterval = null
    this.pausedTime = 0  // 暫停累計時間
    this.pauseStartTime = null  // 當前暫停開始時間

    this.monsters = []
    this.monsterSpawnTimer = null
    this.firstMonsterTimer = null
    this.lastSpawnTime = 0

    this.isDrawing = false
    this.currentPath = []
    this.drawnPaths = []
    this.fadeOutAnimation = null

    this.npcElement = document.getElementById('zone')
    this.npcBounds = null

    // 前導影片相關
    this.introVideo = null
    this.imagesPreloaded = false

    // 🌟 新增：路徑狀態追蹤
    this.layer1Path = null
    this.layer2Path = null
    this.layer3Path = null

    // 🌟 新增：結局影片預載狀態
    this.endVideosPreloaded = false

    this.init()
  }

  init() {
    this.setupCanvas()
    this.createPauseButton()
    this.setupEventListeners()
    this.updateNPCBounds()
    this.setupIntroVideo()

    // 設置playground overflow hidden
    const playground = document.getElementById('playground')
    playground.style.overflow = 'hidden'

    // 監聽視窗大小變化
    window.addEventListener('resize', () => {
      this.setupCanvas()
      this.updateNPCBounds()
    })
  }

  createPauseButton() {
    const playground = document.getElementById('playground')
    const pauseButton = document.createElement('button')
    pauseButton.id = 'pause-button'
    pauseButton.textContent = 'PAUSE'
    pauseButton.style.display = 'none'

    playground.appendChild(pauseButton)
  }

  setupCanvas() {
    const playground = document.getElementById('playground')
    const rect = playground.getBoundingClientRect()
    this.canvas.width = rect.width
    this.canvas.height = rect.height

    // 調整筆畫樣式為法杖光感效果
    const lineWidth = Math.max(4, (12 / 1440) * rect.width)

    // 設定基礎筆畫樣式
    this.ctx.strokeStyle = '#ffd700c9' // 金色光芒
    this.ctx.lineWidth = lineWidth
    this.ctx.lineCap = 'round'
    this.ctx.lineJoin = 'round'
  }

  // 🌟 法杖光感繪製函數
  drawMagicalStroke(point) {
    const lineWidth = this.ctx.lineWidth

    // 保存當前狀態
    this.ctx.save()

    // 第一層：外圈光暈
    this.ctx.strokeStyle = '#ffe55cc9'
    this.ctx.lineWidth = lineWidth * 1.5
    this.ctx.shadowColor = '#ffb347'
    this.ctx.shadowBlur = lineWidth * 2
    this.ctx.globalAlpha = 0.1
    if (!this.layer1Path) {
      this.layer1Path = new Path2D()
      this.layer1Path.moveTo(point.X, point.Y)
    }
    this.layer1Path.lineTo(point.X, point.Y)
    this.ctx.stroke(this.layer1Path)

    // 第二層：中間光芒
    this.ctx.strokeStyle = '#ffd700c9'
    this.ctx.lineWidth = lineWidth * 1.1
    this.ctx.shadowBlur = lineWidth * 1.2
    this.ctx.globalAlpha = 0.4
    if (!this.layer2Path) {
      this.layer2Path = new Path2D()
      this.layer2Path.moveTo(point.X, point.Y)
    }
    this.layer2Path.lineTo(point.X, point.Y)
    this.ctx.stroke(this.layer2Path)

    // 第三層：核心光線
    this.ctx.strokeStyle = '#fff8dcc9'
    this.ctx.lineWidth = lineWidth * 0.6
    this.ctx.shadowBlur = lineWidth * 0.6
    this.ctx.globalAlpha = 0.85
    if (!this.layer3Path) {
      this.layer3Path = new Path2D()
      this.layer3Path.moveTo(point.X, point.Y)
    }
    this.layer3Path.lineTo(point.X, point.Y)
    this.ctx.stroke(this.layer3Path)

    // 恢復狀態
    this.ctx.restore()
  }

  // 🌟 繪製起始光點效果
  drawStartPoint(point) {
    this.ctx.save()

    // 外圈光暈
    this.ctx.beginPath()
    this.ctx.fillStyle = '#ffe55cc9'
    this.ctx.shadowColor = '#ffb347c9'
    this.ctx.shadowBlur = this.ctx.lineWidth * 3
    this.ctx.globalAlpha = 0.25
    this.ctx.arc(point.X, point.Y, this.ctx.lineWidth * 1.2, 0, Math.PI * 2)
    this.ctx.fill()

    // 核心光點
    this.ctx.beginPath()
    this.ctx.fillStyle = '#fff8dc'
    this.ctx.shadowBlur = this.ctx.lineWidth * 1.5
    this.ctx.globalAlpha = 0.7
    this.ctx.arc(point.X, point.Y, this.ctx.lineWidth * 0.7, 0, Math.PI * 2)
    this.ctx.fill()

    this.ctx.restore()
  }

  setupEventListeners() {
    const startButton = document.getElementById('start-button')
    const restartButton = document.getElementById('restart-button')
    const pauseButton = document.getElementById('pause-button')

    startButton.addEventListener('click', () => this.startGame())
    restartButton.addEventListener('click', () => this.restartGame())
    pauseButton.addEventListener('click', () => this.togglePause())

    // 畫布事件
    this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e))
    this.canvas.addEventListener('mousemove', (e) => this.draw(e))
    this.canvas.addEventListener('mouseup', () => this.stopDrawing())
    this.canvas.addEventListener('mouseleave', () => this.stopDrawing())

    // 觸控事件
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault()
      this.startDrawing(e.touches[0])
    })
    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault()
      this.draw(e.touches[0])
    })
    this.canvas.addEventListener('touchend', (e) => {
      e.preventDefault()
      this.stopDrawing()
    })

    // 鍵盤事件（空白鍵暫停）
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && this.gameState === 'playing') {
        e.preventDefault()
        this.togglePause()
      }
    })
  }

  // === 暫停功能 ===
  togglePause() {
    console.log(`當前遊戲狀態: ${this.gameState}`)

    if (this.gameState === 'playing') {
      this.pauseGame()
    } else if (this.gameState === 'paused') {
      this.resumeGame()
    }
  }

  pauseGame() {
    console.log('🛑 開始暫停程序...');
    this.gameState = 'paused';
    this.pauseStartTime = Date.now();

    // 暫停所有怪物、凍結當前 top/right
    const playground = document.getElementById('playground');
    const playgroundRect = playground.getBoundingClientRect();
    this.monsters.forEach(monster => {
      if (monster.animationId) {
        cancelAnimationFrame(monster.animationId);
        monster.animationId = null;
      }
      monster.pausedAt = Date.now();

      const el = monster.element;
      if (!el) return;

      // 讀出計算後的 CSS top/right
      const comp = window.getComputedStyle(el);
      const freezeTop = comp.top;
      const freezeRight = comp.right;

      // 立刻關掉過渡，並鎖定位置
      el.style.transition = 'none';
      el.style.top = freezeTop;
      el.style.right = freezeRight;
    });

    // 暫停背景音樂 & 計時器
    if (this.bgm && !this.bgm.paused) this.bgm.pause();
    if (this.timerInterval) { clearInterval(this.timerInterval); this.timerInterval = null; }
    if (this.monsterSpawnTimer) { clearInterval(this.monsterSpawnTimer); this.monsterSpawnTimer = null; }
    if (this.firstMonsterTimer) { clearTimeout(this.firstMonsterTimer); this.firstMonsterTimer = null; }

    // 更新按鈕文字
    const btn = document.getElementById('pause-button');
    if (btn) btn.textContent = 'RESUME';

    console.log('✅ 遊戲暫停完成');
  }

  resumeGame() {
    console.log('▶️ 開始恢復程序...');
    // 補償全域暫停時間（用於生成邏輯）
    const pauseDuration = Date.now() - this.pauseStartTime;
    this.pausedTime += pauseDuration;

    // 解除凍結：只恢復 transition
    this.monsters.forEach(monster => {
      const el = monster.element;
      if (!el) return;
      el.style.transition = '';
      // 不改 top/right，animateMonster 會在第一幀覆蓋它們
      delete monster.pausedAt;
    });

    // 改回 playing、恢復音樂、再啟動計時與動畫
    this.gameState = 'playing';
    if (this.bgm && this.bgm.paused) this.bgm.play().catch(e => console.warn(e));
    this.startTimer();
    this.startMonsterSpawning();
    this.monsters.forEach(monster => {
      if (!monster.isDestroyed) {
        this.animateMonster(monster);
      }
    });

    const btn = document.getElementById('pause-button');
    if (btn) btn.textContent = 'PAUSE';

    console.log('✅ 遊戲恢復完成');
  }

  // === 前導影片控制 ===
  setupIntroVideo() {
    this.introVideo = document.getElementById('intro-video')
    const playButton = document.getElementById('play-button')
    const videoLoading = document.getElementById('video-loading')

    // 設置假圖為封面
    const coverImageUrl = 'images/fake-cover.webp'
    this.introVideo.poster = coverImageUrl

    // 🔧 修復：監聽播放事件隱藏按鈕
    this.introVideo.addEventListener('play', () => {
      playButton.style.display = 'none'
      playButton.style.opacity = '0'
      console.log('影片開始播放，隱藏播放按鈕')
    })

    // 預載影片
    this.introVideo.addEventListener('loadeddata', () => {
      videoLoading.style.display = 'none'
      playButton.style.display = 'flex'

      // 立即開始預載遊戲圖片
      this.preloadGameImages()
    })

    // 播放按鈕點擊事件
    playButton.addEventListener('click', () => {
      this.introVideo.style.display = 'block'
      this.introVideo.play()
    })

    // 影片播放完成事件
    this.introVideo.addEventListener('ended', () => {
      this.showStartButton()
    })

    // 開始載入影片並預載怪物圖片
    this.preloadMonsterImages()
    // 🌟 預載結局影片
    this.preloadEndVideos()
    this.introVideo.load()
  }

  preloadMonsterImages() {
    const monsterImages = [
      'images/monster-o-default.webp',
      'images/monster-o-good.webp',
      'images/monster-o-missed.webp',
      'images/monster-u-default.webp',
      'images/monster-u-good.webp',
      'images/monster-u-missed.webp',
      'images/monster-z-default.webp',
      'images/monster-z-good.webp',
      'images/monster-z-missed.webp'
    ]

    let monstersLoaded = 0
    monsterImages.forEach(src => {
      const img = new Image()
      img.onload = () => {
        monstersLoaded++
        if (monstersLoaded === monsterImages.length) {
          console.log('怪物圖片預載完成')
        }
      }
      img.src = src
    })
  }

  preloadGameImages() {
    if (this.imagesPreloaded) return

    const otherImages = [
      'images/playground-bg.webp',
      'images/king-body.webp',
      'images/king-head.webp',
      'images/knight.webp',
      'images/knight-light.webp',
      'images/knight-wand.webp',
      'images/life.webp'
    ]

    let loadedCount = 0
    otherImages.forEach(src => {
      const img = new Image()
      img.onload = () => {
        loadedCount++
        if (loadedCount === otherImages.length) {
          this.imagesPreloaded = true
          console.log('遊戲圖片預載完成')
        }
      }
      img.src = src
    })
  }

  // 🌟 新增：預載結局影片
  preloadEndVideos() {
    if (this.endVideosPreloaded) return

    const endVideos = [
      { src: 'src/be.mp4', name: '結局A' },
      { src: 'src/ge.mp4', name: '結局B' }
    ]

    let loadedCount = 0
    endVideos.forEach(({ src, name }) => {
      const video = document.createElement('video')
      video.preload = 'auto'
      video.muted = true // 避免自動播放限制

      video.addEventListener('loadeddata', () => {
        loadedCount++
        console.log(`${name}影片預載完成`)

        if (loadedCount === endVideos.length) {
          this.endVideosPreloaded = true
          console.log('所有結局影片預載完成')
        }
      })

      video.addEventListener('error', (e) => {
        console.warn(`${name}影片預載失敗:`, e)
        loadedCount++
        if (loadedCount === endVideos.length) {
          this.endVideosPreloaded = true
        }
      })

      video.src = src
    })
  }

  showStartButton() {
    const startButton = document.getElementById('start-button')
    const gameStart = document.getElementById('game-start')

    gameStart.style.display = 'flex'
    startButton.style.display = 'block'
    startButton.style.zIndex = '101'

    console.log('影片播放完成，顯示START按鈕')
  }

  hideIntroAndShowGame() {
    document.getElementById('intro-container').style.display = 'none'
    document.getElementById('lives-container').style.display = 'flex'
    document.getElementById('timer').style.display = 'block'
    this.gameState = 'waiting'
  }

  // === 遊戲流程控制 ===
  startGame() {
    if (this.gameState === 'intro') {
      this.hideIntroAndShowGame()
    }

    // 播放背景音樂
    if (this.bgm) {
      this.bgm.currentTime = 0
      this.bgm.volume = 0.2
      this.bgm.play().catch(e => {
        console.warn("自動播放失敗，可能需要點擊觸發", e)
      })
    }

    this.gameState = 'playing'
    this.lives = 5
    this.startTime = Date.now()
    this.currentTime = 0
    this.pausedTime = 0
    this.pauseStartTime = null
    this.monsters = []
    this.drawnPaths = []
    this.currentPath = []
    this.lastSpawnTime = 0

    // 重置光效路徑狀態
    this.layer1Path = null
    this.layer2Path = null
    this.layer3Path = null

    // 隱藏所有UI
    document.getElementById('game-start').style.display = 'none'
    document.getElementById('game-over-modal').style.display = 'none'
    document.getElementById('pause-button').style.display = 'block'

    // 清除所有計時器
    this.clearAllTimers()

    // 移除所有怪物
    this.removeAllMonsters()

    this.updateLivesDisplay()
    this.startTimer()
    this.scheduleFirstMonster()
    this.startMonsterSpawning()
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)

    this.gameLoop()
  }

  restartGame() {
    // 中斷結局影片播放
    const endVideo = document.getElementById('end-video')
    if (endVideo && !endVideo.paused) {
      endVideo.pause()
      endVideo.currentTime = 0
      endVideo.style.display = 'none'
      console.log('🎬 結局影片已中斷')
    }

    if (this.gameState === 'intro') {
      this.hideIntroAndShowGame()
    }

    this.lives = 5
    this.updateLivesDisplay()
    this.startGame()
  }

  determineEndingType() {
    const gameTimeSeconds = this.currentTime / 1000
    console.log(`遊戲結束時間: ${gameTimeSeconds.toFixed(2)}秒`)

    if (gameTimeSeconds >= 120) { // 2分鐘
      return 'B' // 結局B：Good Sleep!
    } else {
      return 'A' // 結局A：Duck King needs more sleep...
    }
  }

  setupEndingContent(endingType) {
    const endingTitle = document.getElementById('ending-title')
    const endVideo = document.getElementById('end-video')
    const videoSource = endVideo.querySelector('source')

    if (endingType === 'A') {
      endingTitle.textContent = 'Duck King needs more sleep...'
      videoSource.src = 'src/be.mp4'
      console.log('設置結局A：Duck King needs more sleep...（未達2:00）')
    } else {
      endingTitle.textContent = 'Good Sleep!'
      videoSource.src = 'src/ge.mp4'
      console.log('設置結局B：Good Sleep!（達到2:00以上）')
    }

    endVideo.load()
    endVideo.autoplay = false
    endVideo.preload = 'auto'

    return new Promise((resolve) => {
      const onLoadedMetadata = () => {
        console.log(`結局${endingType}影片載入完成`)
        endVideo.removeEventListener('loadedmetadata', onLoadedMetadata)
        resolve(endingType)
      }

      endVideo.addEventListener('loadedmetadata', onLoadedMetadata)

      // 防止載入失敗卡住
      setTimeout(() => {
        endVideo.removeEventListener('loadedmetadata', onLoadedMetadata)
        console.warn('影片載入超時，繼續執行')
        resolve(endingType)
      }, 3000)
    })
  }

  playEndingVideoAfterUI() {
    const endVideo = document.getElementById('end-video')

    console.log('開始播放結局影片...')

    // 設置影片樣式：覆蓋整個模態框
    endVideo.style.position = 'absolute'
    endVideo.style.top = '0'
    endVideo.style.left = '0'
    endVideo.style.width = '100%'
    endVideo.style.height = '100%'
    endVideo.style.objectFit = 'cover'
    endVideo.style.zIndex = '31'
    endVideo.style.display = 'block'

    // 設置影片結束後的行為
    const onVideoEnded = () => {
      console.log('結局影片播放完成，停在最後一幀')
      endVideo.removeEventListener('ended', onVideoEnded)
    }

    endVideo.addEventListener('ended', onVideoEnded)

    // 播放影片
    endVideo.play().catch(e => {
      console.warn('結局影片播放失敗:', e)
      endVideo.removeEventListener('ended', onVideoEnded)
      endVideo.style.display = 'none'
    })
  }

  gameOver() {
    this.gameState = 'gameOver'
    this.clearAllTimers()
    this.removeAllMonsters()

    // 停止背景音樂
    if (this.bgm) {
      this.bgm.pause()
      this.bgm.currentTime = 0
    }

    // 隱藏暫停按鈕
    document.getElementById('pause-button').style.display = 'none'

    // 停止動畫
    if (this.fadeOutAnimation) {
      cancelAnimationFrame(this.fadeOutAnimation)
      this.fadeOutAnimation = null
    }

    // 判斷結局類型
    const endingType = this.determineEndingType()

    // 設置最終時間顯示
    const finalTime = this.formatTime(this.currentTime)
    document.getElementById('final-time').textContent = `TIME: ${finalTime}`

    // 顯示遊戲結束模態框
    document.getElementById('game-over-modal').style.display = 'flex'

    console.log('顯示結局UI，準備載入影片...')

    // 設置結局內容並等待影片載入完成
    this.setupEndingContent(endingType).then((loadedEndingType) => {
      console.log(`結局${loadedEndingType}內容設置完成，UI已顯示`)

      // 等待UI渲染完成後播放影片
      setTimeout(() => {
        this.playEndingVideoAfterUI()
      }, 1000)
    })
  }

  // === 計時器相關 ===
  startTimer() {
    this.timerInterval = setInterval(() => {
      const totalElapsed = Date.now() - this.startTime
      this.currentTime = totalElapsed - this.pausedTime
      this.updateTimerDisplay()
    }, 100)
  }

  updateTimerDisplay() {
    const totalSeconds = Math.floor(this.currentTime / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}`
    document.getElementById('timer').textContent = timeString
  }

  formatTime(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}`
  }

  clearAllTimers() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval)
      this.timerInterval = null
    }

    if (this.monsterSpawnTimer) {
      clearInterval(this.monsterSpawnTimer)
      this.monsterSpawnTimer = null
    }

    if (this.firstMonsterTimer) {
      clearTimeout(this.firstMonsterTimer)
      this.firstMonsterTimer = null
    }

    if (this.fadeOutAnimation) {
      cancelAnimationFrame(this.fadeOutAnimation)
      this.fadeOutAnimation = null
    }
  }

  // === 怪物生成和管理 ===
  getDifficultyLevel() {
    const gameTimeSeconds = (Date.now() - this.startTime - this.pausedTime) / 1000

    if (gameTimeSeconds < 60) {
      return 0
    } else {
      return Math.floor((gameTimeSeconds - 60) / 30) + 1
    }
  }

  getSpeedMultiplier() {
    const difficultyLevel = this.getDifficultyLevel()
    const speedMultiplier = 1 + (difficultyLevel * 0.15)
    const maxMultiplier = 2.0
    const finalMultiplier = Math.min(speedMultiplier, maxMultiplier)

    if (difficultyLevel > 0) {
      console.log(`🎯 難度等級 ${difficultyLevel}: 速度倍率 ${finalMultiplier.toFixed(2)}x`)
    }

    return finalMultiplier
  }

  getBaseAnimationDuration(playgroundWidth) {
    return Math.max(6000, 9000 * (playgroundWidth / 1440))
  }

  getMaxMonsters() {
    const currentGameTime = (Date.now() - this.startTime - this.pausedTime) / 1000

    if (currentGameTime >= 30 && this.lives >= 4) {
      return 5
    }

    return 3
  }

  getSpawnDelay(gameTimeSeconds) {
    const baseDelay = 3000
    const minDelay = 600
    const difficultyLevel = this.getDifficultyLevel()

    if (gameTimeSeconds < 60) {
      const earlyGameLevel = Math.floor(gameTimeSeconds / 20)
      const currentDelay = baseDelay * Math.pow(0.9, earlyGameLevel)
      return Math.max(1500, currentDelay)
    } else {
      const delayReduction = difficultyLevel * 0.2
      const currentDelay = baseDelay * (1 - delayReduction)
      const finalDelay = Math.max(minDelay, currentDelay)

      console.log(`📈 後期生成延遲: ${(finalDelay / 1000).toFixed(1)}秒 (難度等級 ${difficultyLevel})`)
      return finalDelay
    }
  }

  scheduleFirstMonster() {
    this.firstMonsterTimer = setTimeout(() => {
      this.spawnMonster()
    }, 3000)
  }

  startMonsterSpawning() {
    this.monsterSpawnTimer = setInterval(() => {
      const maxMonsters = this.getMaxMonsters()
      const currentGameTime = (Date.now() - this.startTime - this.pausedTime) / 1000

      const shouldForceSpawn = currentGameTime > 60 && Math.random() < 0.1

      if (this.monsters.length < maxMonsters || shouldForceSpawn) {
        this.spawnMonster()
      }
    }, 800)
  }

  spawnMonster() {
    if (this.gameState !== 'playing') return

    const currentGameTime = (Date.now() - this.startTime - this.pausedTime) / 1000

    if (this.lastSpawnTime && Date.now() - this.lastSpawnTime < this.getSpawnDelay(currentGameTime)) {
      return
    }

    const letters = ['Z', 'U', 'O']
    const letter = letters[Math.floor(Math.random() * letters.length)]

    const playground = document.getElementById('playground')
    const playgroundRect = playground.getBoundingClientRect()

    const monsterSize = playgroundRect.width * 0.15

    // 計算可用的Y軸范圍
    const minY = monsterSize / 2
    const maxY = playgroundRect.height - monsterSize / 2

    // 確保不與現有怪物重疊
    let y
    let attempts = 0
    do {
      y = Math.random() * (maxY - minY) + minY
      attempts++
    } while (attempts < 10 && this.isPositionOccupied(y, monsterSize))

    // 🔧 修正：使用統一的座標系統 - 以playground左上角為原點
    const monster = {
      id: Date.now() + Math.random(),
      letter: letter,
      x: playgroundRect.width, // 從右邊界開始
      y: y, // Y座標以playground頂部為基準
      size: monsterSize,
      startTime: Date.now(),
      speedLevel: 0,
      animationId: null,
      element: this.createMonsterElement(letter, y, monsterSize),
    }

    this.monsters.push(monster)
    playground.appendChild(monster.element)
    this.lastSpawnTime = Date.now()

    const nextDelay = this.getSpawnDelay(currentGameTime) / 1000
    const difficultyLevel = this.getDifficultyLevel()
    const speedMultiplier = this.getSpeedMultiplier()

    console.log(`👹 生成怪物 ${letter} - 遊戲時間: ${currentGameTime.toFixed(1)}s, 難度等級: ${difficultyLevel}, 全域速度: ${speedMultiplier.toFixed(2)}x, 下次延遲: ${nextDelay.toFixed(1)}s`)

    this.animateMonster(monster)
  }

  isPositionOccupied(y, size) {
    const minDistance = size * 0.8
    return this.monsters.some((monster) => Math.abs(monster.y - y) < minDistance)
  }

  createMonsterElement(letter, y, size) {
    const element = document.createElement('div')
    element.className = `monster ${letter}`
    element.style.top = `${y - size / 2}px`
    element.style.right = `${-size}px`
    element.style.width = `${size}px`
    element.style.height = `${size}px`
    return element
  }

  animateMonster(monster) {
    // 🔧 開始前就檢查狀態
    if (this.gameState !== 'playing') {
      console.log(`⚠️ 遊戲狀態為 ${this.gameState}，跳過怪物 ${monster.letter} 動畫啟動`)
      return
    }

    if (!this.monsters.includes(monster)) {
      console.log(`⚠️ 怪物 ${monster.letter} 不在列表中，跳過動畫`)
      return
    }

    const playground = document.getElementById('playground')
    const playgroundRect = playground.getBoundingClientRect()

    this.updateNPCBounds()
    const npcCenterX = this.npcBounds.left + (this.npcBounds.right - this.npcBounds.left) / 2
    const npcCenterY = this.npcBounds.top + (this.npcBounds.bottom - this.npcBounds.top) / 2

    const startX = monster.x
    const startY = monster.y
    const targetX = npcCenterX
    const targetY = npcCenterY

    let baseDuration = this.getBaseAnimationDuration(playgroundRect.width)

    const totalDistance = playgroundRect.width - targetX
    const remainingDistance = startX - targetX
    const progressRatio = Math.max(0.1, remainingDistance / totalDistance)

    const globalSpeedMultiplier = this.getSpeedMultiplier()
    const individualSpeedMultiplier = Math.pow(1.25, monster.speedLevel || 0)
    const combinedSpeedMultiplier = globalSpeedMultiplier * individualSpeedMultiplier

    const duration = (baseDuration * progressRatio) / combinedSpeedMultiplier

    console.log(`🏃 怪物 ${monster.letter} 動畫開始 - 從(${startX.toFixed(0)}, ${startY.toFixed(0)})到(${targetX.toFixed(0)}, ${targetY.toFixed(0)})，持續時間: ${(duration / 1000).toFixed(1)}秒`)

    const startTime = Date.now()

    const animate = () => {
      // 🌟 每一幀都要檢查狀態 - 這是防止飛行的關鍵
      if (this.gameState !== 'playing') {
        console.log(`🛑 怪物 ${monster.letter} 動畫因狀態變更停止 (當前狀態: ${this.gameState})`)
        return
      }

      if (!this.monsters.includes(monster)) {
        console.log(`🛑 怪物 ${monster.letter} 已被移除，停止動畫`)
        return
      }

      if (monster.isDestroyed) {
        console.log(`🛑 怪物 ${monster.letter} 已被摧毀，停止動畫`)
        return
      }

      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)

      // 計算新位置
      const newX = startX + (targetX - startX) * progress
      const newY = startY + (targetY - startY) * progress

      // 更新怪物座標
      monster.x = newX
      monster.y = newY

      // 更新DOM位置
      const cssRight = playgroundRect.width - newX - monster.size / 2
      const cssTop = newY - monster.size / 2

      monster.element.style.right = `${cssRight}px`
      monster.element.style.top = `${cssTop}px`

      if (progress >= 1) {
        // 動畫完成
        if (!monster.isDestroyed) {
          this.monsterReachedNPC(monster)
        } else {
          this.removeMonster(monster)
        }
      } else {
        // 🔧 再次確認狀態才請求下一幀
        if (this.gameState === 'playing' && this.monsters.includes(monster) && !monster.isDestroyed) {
          monster.animationId = requestAnimationFrame(animate)
        } else {
          console.log(`🛑 怪物 ${monster.letter} 動畫在幀結束時檢測到狀態變更，停止`)
          monster.animationId = null
        }
      }
    }

    // 取消之前的動畫
    if (monster.animationId) {
      cancelAnimationFrame(monster.animationId)
      monster.animationId = null
    }

    // 只有在遊戲狀態正確時才開始
    if (this.gameState === 'playing') {
      monster.animationId = requestAnimationFrame(animate)
    } else {
      console.log(`⚠️ 遊戲狀態為 ${this.gameState}，不啟動怪物 ${monster.letter} 動畫`)
    }
  }

  monsterReachedNPC(monster) {
    console.log(`👹 怪物 ${monster.letter} 到達 NPC，扣除生命值`)
    this.loseLife()
    this.removeMonster(monster)
  }

  removeMonster(monster) {
    // 確保清理動畫
    if (monster.animationId) {
      cancelAnimationFrame(monster.animationId)
      monster.animationId = null
    }

    const index = this.monsters.indexOf(monster)
    if (index > -1) {
      this.monsters.splice(index, 1)
      if (monster.element && monster.element.parentNode) {
        monster.element.parentNode.removeChild(monster.element)
      }
      console.log(`🗑️ 移除怪物 ${monster.letter}`)
    }
  }

  removeAllMonsters() {
    this.monsters.forEach(monster => {
      // 確保清理動畫
      if (monster.animationId) {
        cancelAnimationFrame(monster.animationId)
        monster.animationId = null
      }

      if (monster.element && monster.element.parentNode) {
        monster.element.parentNode.removeChild(monster.element)
      }
    })
    this.monsters = []
    console.log('🗑️ 清除所有怪物')
  }

  destroyMonster(monster) {
    console.log(`🎉 摧毀怪物 ${monster.letter}`);

    // 1. 先取消 requestAnimationFrame，避免後續更新位置
    if (monster.animationId) {
      cancelAnimationFrame(monster.animationId);
      monster.animationId = null;
      console.log(`🛑 已取消怪物 ${monster.letter} 的動畫迴圈`);
    }

    monster.isDestroyed = true;

    const el = monster.element;
    if (el) {
      // 2. 計算當前螢幕座標，轉成相對 playground 的 left/top
      const playground = document.getElementById('playground');
      const parentRect = playground.getBoundingClientRect();
      const rect = el.getBoundingClientRect();
      const freezeLeft = rect.left - parentRect.left;
      const freezeTop = rect.top - parentRect.top;

      // 3. 立刻關掉過渡，並用 absolute + left/top 鎖定位置
      el.style.transition = 'none';
      el.style.position = 'absolute';
      el.style.left = `${freezeLeft}px`;
      el.style.top = `${freezeTop}px`;
      el.style.right = 'auto';

      // 4. 加上擊中樣式
      el.classList.add('good');
      console.log(`✨ 為怪物 ${monster.letter} 添加 GOOD 樣式`);

      // 5. 顯示 GOOD! 文字
      this.showStatusText(monster, 'GOOD!', 'good');

      // 6. 延遲淡出
      setTimeout(() => {
        el.style.opacity = '0';
      }, 700);

      // 7. 再延遲完全移除
      setTimeout(() => {
        el.classList.remove('good');
        this.removeMonster(monster);
        console.log(`🗑️ 已移除怪物 ${monster.letter}`);
      }, 999);
    }

    // 8. 維持遊戲節奏：觸發淡出 & 重置 spawn 計時
    this.startFadeOut();
    const max = this.getMaxMonsters();
    if (this.monsters.length === 1) {
      this.lastSpawnTime = 0;
    } else if (this.monsters.length <= max) {
      this.lastSpawnTime = Date.now() - 2000;
    }
  }

  // === 繪圖和識別 ===
  // 🔧 修正：統一NPC邊界更新方法
  updateNPCBounds() {
    const npcRect = this.npcElement.getBoundingClientRect()
    const playgroundRect = document.getElementById('playground').getBoundingClientRect()

    // 轉換為playground內部座標系統
    this.npcBounds = {
      left: npcRect.left - playgroundRect.left,
      top: npcRect.top - playgroundRect.top,
      right: npcRect.right - playgroundRect.left,
      bottom: npcRect.bottom - playgroundRect.top,
    }

    console.log(`📍 NPC邊界更新: left=${this.npcBounds.left.toFixed(0)}, top=${this.npcBounds.top.toFixed(0)}, right=${this.npcBounds.right.toFixed(0)}, bottom=${this.npcBounds.bottom.toFixed(0)}`)
  }

  startDrawing(e) {
    if (this.gameState !== 'playing') return

    if (this.fadeOutAnimation) {
      cancelAnimationFrame(this.fadeOutAnimation)
      this.fadeOutAnimation = null
    }

    this.isDrawing = true
    this.currentPath = []

    // 重置所有光效路徑
    this.layer1Path = null
    this.layer2Path = null
    this.layer3Path = null

    const rect = this.canvas.getBoundingClientRect()
    const point = new Point(e.clientX - rect.left, e.clientY - rect.top)
    this.currentPath.push(point)

    this.drawStartPoint(point)
  }

  draw(e) {
    if (!this.isDrawing || this.gameState !== 'playing') return

    const rect = this.canvas.getBoundingClientRect()
    const point = new Point(e.clientX - rect.left, e.clientY - rect.top)
    this.currentPath.push(point)

    this.drawMagicalStroke(point)
  }

  stopDrawing() {
    if (!this.isDrawing || this.gameState !== 'playing') return

    this.isDrawing = false

    // 重置路徑狀態
    this.layer1Path = null
    this.layer2Path = null
    this.layer3Path = null

    if (this.currentPath.length > 3) {
      this.recognizeGesture()
    } else {
      console.log(`⚠️ 筆畫點數太少 (${this.currentPath.length})，不進行識別`)
      this.startFadeOut()
    }
  }

  recognizeGesture() {
    const result = this.recognizer.Recognize(this.currentPath)

    console.log(`識別結果: ${result.Name}, 分數: ${result.Score?.toFixed(3) || 0}`)

    if (result.Name && result.Score > 0.1) {
      console.log(`✅ 識別到形狀: ${result.Name}，開始檢查怪物匹配`)
      this.checkMonsterMatch(result.Name)
    } else {
      console.log(`❌ 未識別到有效形狀`)
      this.handleFailedGesture()
    }

    this.drawnPaths.push([...this.currentPath])
    this.currentPath = []
  }

  checkMonsterMatch(recognizedLetter) {
    console.log(`檢查怪物匹配: 識別到 ${recognizedLetter}`)
    console.log(`目前場上怪物:`, this.monsters.map(m => `${m.letter} at (${m.x.toFixed(0)}, ${m.y.toFixed(0)})`))

    const hitMonster = this.monsters.find((monster) => {
      const letterMatch = monster.letter === recognizedLetter
      return letterMatch
    })

    if (hitMonster) {
      console.log(`🎯 成功打敗怪物 ${hitMonster.letter}! (字母匹配)`)
      this.destroyMonster(hitMonster)
    } else {
      console.log(`💥 場上沒有 ${recognizedLetter} 怪物`)
      this.handleFailedGesture()
    }
  }

  handleFailedGesture() {
    console.log(`⚡ 攻擊失敗，加速所有怪物`)
    this.accelerateAllMonsters()
    this.startFadeOut()
  }

  accelerateAllMonsters() {
    this.monsters.forEach(monster => {
      if (monster.isDestroyed) {
        return
      }

      const maxSpeedLevel = 4
      if ((monster.speedLevel || 0) < maxSpeedLevel) {
        monster.speedLevel = (monster.speedLevel || 0) + 1
        console.log(`🚀 怪物 ${monster.letter} 加速至等級 ${monster.speedLevel}`)

        this.animateMonster(monster)
        this.showSpeedUpEffect(monster)
      }
    })

    this.lastSpawnTime = Math.max(0, this.lastSpawnTime - 1000)
    console.log(`⚡ 攻擊失敗，下一隻怪物提前生成`)
  }

  showSpeedUpEffect(monster) {
    if (monster.isDestroyed) {
      return
    }

    if (monster.element) {
      monster.element.classList.add('missed')
      this.showStatusText(monster, 'MISSED!', 'missed')

      const statusText = document.querySelector(`.status-text.missed`)

      setTimeout(() => {
        if (statusText) {
          statusText.style.opacity = '0'
          setTimeout(() => {
            statusText.remove()
          }, 850)
        }
      }, 850)

      setTimeout(() => {
        if (monster.element && !monster.isDestroyed) {
          monster.element.classList.remove('missed')
        }
      }, 850)
    }
  }

  showStatusText(monster, text, type) {
    const playground = document.getElementById('playground')
    const statusText = document.createElement('div')
    statusText.textContent = text
    statusText.className = `status-text ${type}`

    statusText.style.position = 'absolute'
    statusText.style.zIndex = '25'
    statusText.style.textAlign = 'center'
    statusText.style.transform = 'translateX(-50%)'

    playground.appendChild(statusText)

    const updatePosition = () => {
      if (!statusText.parentNode || !this.monsters.includes(monster)) {
        return
      }

      // 🔧 修正：使用統一座標系統定位狀態文字
      const playground = document.getElementById('playground')
      const playgroundRect = playground.getBoundingClientRect()
      const offsetY = playgroundRect.width * 0.02

      statusText.style.left = `${monster.x + (playgroundRect.width * 0.08)}px`
      statusText.style.top = `${monster.y - monster.size / 2 - offsetY}px`

      requestAnimationFrame(updatePosition)
    }

    updatePosition()

    setTimeout(() => {
      if (statusText.parentNode) {
        statusText.parentNode.removeChild(statusText)
      }
    }, 850)
  }

  startFadeOut() {
    if (this.fadeOutAnimation) {
      cancelAnimationFrame(this.fadeOutAnimation)
    }

    const startTime = Date.now()
    const fadeDuration = 600

    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height)

    const fadeAnimation = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / fadeDuration, 1)
      const alpha = 1 - progress

      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)

      if (alpha > 0) {
        this.ctx.save()
        this.ctx.globalAlpha = alpha
        this.ctx.shadowColor = '#ffb347'
        this.ctx.shadowBlur = 10 * alpha
        this.ctx.putImageData(imageData, 0, 0)
        this.ctx.restore()

        this.fadeOutAnimation = requestAnimationFrame(fadeAnimation)
      } else {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
        this.drawnPaths = []
        this.fadeOutAnimation = null
      }
    }

    this.fadeOutAnimation = requestAnimationFrame(fadeAnimation)
  }

  // === UI 和生命值管理 ===
  loseLife() {
    this.lives--
    console.log(`💔 失去生命值，剩餘: ${this.lives}`)
    this.updateLivesDisplay()

    if (this.lives <= 0) {
      this.gameOver()
    }
  }

  updateLivesDisplay() {
    const lifeIcons = document.querySelectorAll('.life-icon')
    const bubbleElement = document.getElementById('bubble')

    lifeIcons.forEach((icon, index) => {
      if (index < this.lives) {
        icon.style.filter = 'none'
        icon.style.opacity = '1'
      } else {
        icon.style.filter = 'grayscale(100%)'
        icon.style.opacity = '0.6'
      }
    })

    // 根據生命值設置 #bubble 透明度
    if (bubbleElement) {
      let bubbleOpacity
      switch (this.lives) {
        case 5:
          bubbleOpacity = 1.0
          break
        case 4:
          bubbleOpacity = 0.8
          break
        case 3:
          bubbleOpacity = 0.6
          break
        case 2:
          bubbleOpacity = 0.4
          break
        case 1:
          bubbleOpacity = 0.3
          break
        default:
          bubbleOpacity = 0.1
          break
      }
      bubbleElement.style.opacity = bubbleOpacity
    }
  }

  // === 主遊戲循環 ===
  gameLoop() {
    if (this.gameState !== 'playing') return

    this.monsters.forEach((monster) => {
      if (this.isMonsterTouchingNPC(monster)) {
        this.monsterReachedNPC(monster)
      }
    })

    requestAnimationFrame(() => this.gameLoop())
  }

  // 🔧 完全重寫碰撞檢測 - 使用統一座標系統
  isMonsterTouchingNPC(monster) {
    if (!this.npcBounds) {
      console.warn(`⚠️ NPC 邊界未初始化！`)
      return false
    }
    if (monster.isDestroyed) {
      console.log(`怪物 ${monster.letter} 已被擊敗！`)
      return false
    }

    // 使用統一座標系統中的怪物位置
    const monsterCenterX = monster.x
    const monsterCenterY = monster.y
    const monsterRadius = monster.size / 2

    // NPC的中心點和邊界
    const npcCenterX = this.npcBounds.left + (this.npcBounds.right - this.npcBounds.left) / 2
    const npcCenterY = this.npcBounds.top + (this.npcBounds.bottom - this.npcBounds.top) / 2
    const npcWidth = this.npcBounds.right - this.npcBounds.left
    const npcHeight = this.npcBounds.bottom - this.npcBounds.top

    // 使用較嚴格的碰撞檢測 - 怪物中心必須進入NPC核心區域
    const coreRatio = 0
    const npcCoreWidth = npcWidth * coreRatio
    const npcCoreHeight = npcHeight * coreRatio

    const npcCoreLeft = npcCenterX - npcCoreWidth / 2
    const npcCoreRight = npcCenterX + npcCoreWidth / 2
    const npcCoreTop = npcCenterY - npcCoreHeight / 2
    const npcCoreBottom = npcCenterY + npcCoreHeight / 2

    // 檢測怪物中心是否進入NPC核心區域
    const isColliding = (
      monsterCenterX >= npcCoreLeft &&
      monsterCenterX <= npcCoreRight &&
      monsterCenterY >= npcCoreTop &&
      monsterCenterY <= npcCoreBottom
    )

    // 調試輸出
    if (isColliding) {
      console.log(`🎯 碰撞檢測: 怪物 ${monster.letter} 中心點觸碰NPC核心區域`)
      console.log(`   怪物中心: (${monsterCenterX.toFixed(0)}, ${monsterCenterY.toFixed(0)})`)
      console.log(`   NPC中心: (${npcCenterX.toFixed(0)}, ${npcCenterY.toFixed(0)})`)
      console.log(`   NPC核心區域: left=${npcCoreLeft.toFixed(0)}, right=${npcCoreRight.toFixed(0)}, top=${npcCoreTop.toFixed(0)}, bottom=${npcCoreBottom.toFixed(0)}`)
    }

    return isColliding
  }
}

// 初始化遊戲
document.addEventListener('DOMContentLoaded', () => {
  new MonsterGame()
})


/**
 * 
 * 本程式碼僅用於「2025 TWM 數據及生成式 AI 大賽｜Vibe Coding組」參賽，未經授權不得轉載、修改或使用於其他用途。
 *
 * © 數位媒體處 洪詩苹  
 * © 數位媒體處 莊騰雅  
 * © 數位媒體處 吳依真  
 * © 數位媒體處 陳怡萱  
 * © 產品技術處 胡純華  
 *
 * Copyright © 2025 All rights reserved.
 */