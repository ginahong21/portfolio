// recognizer.js - 改進版手勢識別器，大幅提高識別率
class Point {
    constructor(x, y) {
        this.X = x
        this.Y = y
    }
}

class DollarRecognizer {
    constructor() {
        // 大幅降低識別閾值，提高識別成功率
        this.RECOGNITION_THRESHOLD = 0.7

        // 預處理配置
        this.PREPROCESS_CONFIG = {
            useAdvancedPreprocessing: true,  // 是否使用進階預處理（重採樣+歸一化）
            resamplePoints: 40,             // 重採樣點數 - 降低到24點，避免過度簡化
            enableSmoothing: true,          // 是否啟用平滑化
            smoothingWindow: 3              // 平滑化窗口大小 - 降低到3，避免過度平滑
        }

        // 特徵權重配置 - 根據實際測試效果調整
        this.FEATURE_WEIGHTS = {
            // O形特徵權重
            O: {
                aspectRatio: 0.25,      // 長寬比 - 重要特徵
                closeness: 0.30,        // 封閉性 - 最重要特徵
                smoothness: 0.25,       // 圓滑度 - 重要特徵
                sharpCorners: 0.20      // 尖角懲罰 - 中等重要
            },

            // U/V形特徵權重
            U: {
                aspectRatio: 0.20,      // 長寬比 - 中等重要
                opening: 0.25,          // 開口特徵 - 重要特徵
                turningPoint: 0.25,     // 轉折點 - 重要特徵
                direction: 0.20,        // 方向檢測 - 中等重要
                continuity: 0.10        // 連續性 - 較不重要
            },

            // Z形特徵權重
            Z: {
                movement: 0.15,         // 整體移動 - 較不重要
                directionChanges: 0.30, // 方向變化 - 最重要特徵
                zPattern: 0.30,         // Z字型模式 - 最重要特徵
                linearity: 0.20,        // 線性度 - 中等重要
                penalties: 0.10         // 懲罰項 - 較不重要
            }
        }
    }

    // 診斷方法 - 幫助調試識別問題
    diagnoseRecognition(points) {
        console.log('=== 識別診斷開始 ===')
        console.log(`輸入點數: ${points.length}`)

        if (points.length < 3) {
            console.log('❌ 點數太少，無法識別')
            return
        }

        // 檢查原始軌跡
        const bounds = this.getBounds(points)
        console.log(`原始邊界: ${bounds.width.toFixed(2)} x ${bounds.height.toFixed(2)}`)

        // 預處理
        const processed = this.preprocessPoints(points)
        console.log(`預處理後點數: ${processed.length}`)

        if (processed.length < 3) {
            console.log('❌ 預處理後點數太少')
            return
        }

        const processedBounds = this.getBounds(processed)
        console.log(`預處理後邊界: ${processedBounds.width.toFixed(3)} x ${processedBounds.height.toFixed(3)}`)

        // 測試各形狀檢測
        console.log('\n=== 各形狀檢測結果 ===')
        const oScore = this.detectCircle(processed)
        const uScore = this.detectU(processed)
        const zScore = this.detectZ(processed)

        console.log(`O形分數: ${oScore.toFixed(3)} (閾值: ${this.RECOGNITION_THRESHOLD})`)
        console.log(`U形分數: ${uScore.toFixed(3)} (閾值: ${this.RECOGNITION_THRESHOLD})`)
        console.log(`Z形分數: ${zScore.toFixed(3)} (閾值: ${this.RECOGNITION_THRESHOLD})`)

        const maxScore = Math.max(oScore, uScore, zScore)
        const bestShape = maxScore === oScore ? 'O' : maxScore === uScore ? 'U' : 'Z'

        if (maxScore >= this.RECOGNITION_THRESHOLD) {
            console.log(`✅ 最佳匹配: ${bestShape} (分數: ${maxScore.toFixed(3)})`)
        } else {
            console.log(`❌ 無匹配 (最高分: ${bestShape} = ${maxScore.toFixed(3)})`)
            console.log('建議: 降低閾值或調整預處理參數')
        }

        console.log('=== 識別診斷結束 ===')
    }

    // 主要識別函數
    Recognize(points) {
        if (points.length < 3) return { Name: null, Score: 0 }

        console.log(`開始識別，點數: ${points.length}`)

        // 根據配置選擇預處理方式
        let processedPoints
        if (this.PREPROCESS_CONFIG.useAdvancedPreprocessing) {
            processedPoints = this.preprocessPoints(points)
        } else {
            processedPoints = this.preprocessPointsSimple(points)
        }
        console.log(`預處理後點數: ${processedPoints.length}`)

        // 分別檢測每個形狀
        const oScore = this.detectCircle(processedPoints)
        const uScore = this.detectU(processedPoints) // 現在包含V字
        const zScore = this.detectZ(processedPoints)

        console.log(`各形狀分數 - O: ${oScore.toFixed(3)}, U: ${uScore.toFixed(3)}, Z: ${zScore.toFixed(3)}`)

        // 找出最高分的形狀
        const results = [
            { name: 'O', score: oScore },
            { name: 'U', score: uScore }, // V字也會歸類為U
            { name: 'Z', score: zScore }
        ]

        results.sort((a, b) => b.score - a.score)
        const best = results[0]

        console.log(`最佳匹配: ${best.name}, 分數: ${best.score.toFixed(3)}`)

        // 使用更寬鬆的閾值
        if (best.score >= this.RECOGNITION_THRESHOLD) {
            console.log(`✅ 識別成功: ${best.name}`)
            return { Name: best.name, Score: best.score }
        }

        console.log(`❌ 識別失敗，分數太低`)
        return { Name: null, Score: best.score }
    }

    // 改進的預處理：重採樣 + 歸一化
    preprocessPoints(points) {
        if (points.length < 3) {
            console.log('點數太少，跳過預處理')
            return points
        }

        console.log(`原始點數: ${points.length}`)

        // 1. 重採樣到固定點數
        const resampledPoints = this.resample(points, this.PREPROCESS_CONFIG.resamplePoints)
        console.log(`重採樣後點數: ${resampledPoints.length}`)

        // 檢查重採樣是否成功
        if (resampledPoints.length < 3) {
            console.log('重採樣失敗，使用原始點')
            return points
        }

        // 2. 平滑化（可選）
        let smoothedPoints = resampledPoints
        if (this.PREPROCESS_CONFIG.enableSmoothing && resampledPoints.length >= this.PREPROCESS_CONFIG.smoothingWindow) {
            smoothedPoints = this.smoothPoints(resampledPoints, this.PREPROCESS_CONFIG.smoothingWindow)
            console.log(`平滑化後點數: ${smoothedPoints.length}`)
        }

        // 3. 平移到原點（以質心為中心）
        const centroid = this.getCentroid(smoothedPoints)
        const translatedPoints = smoothedPoints.map(p =>
            new Point(p.X - centroid.X, p.Y - centroid.Y)
        )
        console.log(`平移後質心: (0, 0)`)

        // 4. 縮放到標準大小
        const bounds = this.getBounds(translatedPoints)
        const maxDimension = Math.max(bounds.width, bounds.height)

        // 防止除零錯誤
        if (maxDimension < 0.001) {
            console.log('軌跡太小，跳過縮放')
            return translatedPoints
        }

        const normalizedPoints = translatedPoints.map(p =>
            new Point(p.X / maxDimension, p.Y / maxDimension)
        )

        // 重新計算歸一化後的邊界
        const normalizedBounds = this.getBounds(normalizedPoints)
        console.log(`歸一化後最大尺寸: 1.0, 實際邊界: ${normalizedBounds.width.toFixed(3)} x ${normalizedBounds.height.toFixed(3)}`)

        return normalizedPoints
    }

    // 重採樣函數 - 將軌跡重採樣為固定數量的點
    resample(points, numPoints) {
        if (points.length >= numPoints) {
            console.log(`點數已足夠 (${points.length} >= ${numPoints})，跳過重採樣`)
            return points.slice() // 如果點數已經足夠，直接返回
        }

        if (points.length < 2) {
            console.log('點數太少，無法重採樣')
            return points.slice()
        }

        const resampled = []
        const totalLength = this.getPathLength(points)

        if (totalLength < 0.001) {
            console.log('軌跡長度太短，跳過重採樣')
            return points.slice()
        }

        const step = totalLength / (numPoints - 1)
        let currentDistance = 0
        let currentIndex = 0

        resampled.push(new Point(points[0].X, points[0].Y)) // 添加第一個點

        for (let i = 1; i < numPoints - 1; i++) {
            const targetDistance = i * step

            // 找到目標距離對應的點
            while (currentIndex < points.length - 1 && currentDistance < targetDistance) {
                currentDistance += this.distance(points[currentIndex], points[currentIndex + 1])
                currentIndex++
            }

            if (currentIndex >= points.length - 1) {
                break
            }

            // 在兩個點之間進行線性插值
            const prevPoint = points[currentIndex - 1]
            const nextPoint = points[currentIndex]
            const segmentLength = this.distance(prevPoint, nextPoint)

            if (segmentLength < 0.001) {
                // 如果兩點太近，直接使用下一點
                resampled.push(new Point(nextPoint.X, nextPoint.Y))
                continue
            }

            const segmentDistance = targetDistance - (currentDistance - segmentLength)
            const ratio = Math.max(0, Math.min(1, segmentDistance / segmentLength))

            const interpolatedX = prevPoint.X + (nextPoint.X - prevPoint.X) * ratio
            const interpolatedY = prevPoint.Y + (nextPoint.Y - prevPoint.Y) * ratio

            resampled.push(new Point(interpolatedX, interpolatedY))
        }

        resampled.push(new Point(points[points.length - 1].X, points[points.length - 1].Y)) // 添加最後一個點

        console.log(`重採樣完成: ${points.length} -> ${resampled.length} 點`)
        return resampled
    }

    // 計算軌跡總長度
    getPathLength(points) {
        let totalLength = 0
        for (let i = 1; i < points.length; i++) {
            totalLength += this.distance(points[i - 1], points[i])
        }
        return totalLength
    }

    // 計算質心（重心）
    getCentroid(points) {
        let sumX = 0, sumY = 0
        for (let point of points) {
            sumX += point.X
            sumY += point.Y
        }
        return {
            X: sumX / points.length,
            Y: sumY / points.length
        }
    }

    // 平滑化函數 - 使用移動平均濾波
    smoothPoints(points, windowSize) {
        if (points.length < windowSize) return points

        const smoothed = []
        const halfWindow = Math.floor(windowSize / 2)

        for (let i = 0; i < points.length; i++) {
            let sumX = 0, sumY = 0, count = 0

            // 計算窗口內的平均值
            for (let j = Math.max(0, i - halfWindow); j <= Math.min(points.length - 1, i + halfWindow); j++) {
                sumX += points[j].X
                sumY += points[j].Y
                count++
            }

            smoothed.push(new Point(sumX / count, sumY / count))
        }

        return smoothed
    }

    // 更寬鬆的預處理（保留原版本作為備選）
    preprocessPointsSimple(points) {
        const filtered = []
        const minDistance = 1.5  // 降低最小距離要求

        for (let i = 0; i < points.length; i++) {
            if (i === 0 || this.distance(points[i], points[i - 1]) > minDistance) {
                filtered.push(points[i])
            }
        }
        return filtered
    }

    // 圓形檢測（O）
    detectCircle(points) {
        if (points.length < 6) return 0 // 降低最小點數要求

        const bounds = this.getBounds(points)
        // 修改邊界檢查：對於歸一化後的座標，使用更小的閾值
        const minSize = 0.1 // 歸一化後的最小尺寸要求
        if (bounds.width < minSize || bounds.height < minSize) return 0

        console.log(`O形檢測 - 邊界: ${bounds.width.toFixed(3)} x ${bounds.height.toFixed(3)}`)

        const weights = this.FEATURE_WEIGHTS.O
        let weightedScore = 0
        let totalWeight = 0

        // 1. 更寬鬆的長寬比檢測
        const aspectRatio = bounds.width / bounds.height
        // 建議的改進版本
        const aspectScore = 
            // 接近正圓：0.8-1.25 給滿分
            (aspectRatio >= 0.8 && aspectRatio <= 1.25) ? 1.0 :
            // 可接受範圍：0.5-2.0 給中等分數
            (aspectRatio >= 0.5 && aspectRatio <= 2.0) ? 0.7 :
            // 邊緣範圍：0.3-3.0 給低分
            (aspectRatio >= 0.3 && aspectRatio <= 3.0) ? 0.4 :
            // 其他情況：幾乎不可能是圓形
            0.1
        console.log(`O形 - 長寬比: ${aspectRatio.toFixed(2)}, 分數: ${aspectScore.toFixed(2)}, 權重: ${weights.aspectRatio}`)
        weightedScore += aspectScore * weights.aspectRatio
        totalWeight += weights.aspectRatio

        // 2. 封閉性檢測
        const startPoint = points[0]
        const endPoint = points[points.length - 1]
        const closeness = this.distance(startPoint, endPoint)
        const maxDim = Math.max(bounds.width, bounds.height)
        // 修改封閉性檢測：對於歸一化後的座標，使用更小的閾值
        const closeScore = closeness < maxDim * 0.3 ? 1.0 :
            closeness < maxDim * 0.6 ? 0.7 : 0.3
        console.log(`O形 - 封閉性: ${closeness.toFixed(3)}/${(maxDim * 0.4).toFixed(3)}, 分數: ${closeScore.toFixed(2)}, 權重: ${weights.closeness}`)
        weightedScore += closeScore * weights.closeness
        totalWeight += weights.closeness

        // 3. 更寬鬆的圓滑度檢測
        const straightSegments = this.countStraightSegments(points)
        const smoothScore = straightSegments < points.length * 0.5 ? 1.0 :
            straightSegments < points.length * 0.7 ? 0.6 : 0.3
        console.log(`O形 - 直線段數: ${straightSegments}/${points.length}, 分數: ${smoothScore.toFixed(2)}, 權重: ${weights.smoothness}`)
        weightedScore += smoothScore * weights.smoothness
        totalWeight += weights.smoothness

        // 4. 更寬鬆的尖角檢測（懲罰項）
        const hasSharpCorners = this.hasSharpCorners(points)
        let sharpCornerPenalty = 1.0
        if (hasSharpCorners) {
            sharpCornerPenalty = 0.7 // 原本是0.3，現在改為0.7
            console.log(`O形 - 檢測到尖角，懲罰係數: ${sharpCornerPenalty}, 權重: ${weights.sharpCorners}`)
        }

        // 計算加權平均分數
        const finalScore = totalWeight > 0 ? (weightedScore / totalWeight) * sharpCornerPenalty : 0
        console.log(`O形加權分數: ${weightedScore.toFixed(3)}/${totalWeight.toFixed(3)} = ${(weightedScore / totalWeight).toFixed(3)}, 最終分數: ${finalScore.toFixed(3)}`)
        return finalScore
    }

    // 大幅改進的U/V形檢測（統一識別為U），但要排除Z形特徵
    detectU(points) {
        if (points.length < 5) return 0 // 降低最小點數要求

        const bounds = this.getBounds(points)
        // 修改邊界檢查：對於歸一化後的座標，使用更小的閾值
        const minSize = 0.1 // 歸一化後的最小尺寸要求
        if (bounds.width < minSize || bounds.height < minSize) return 0

        console.log(`U/V形檢測 - 邊界: ${bounds.width.toFixed(3)} x ${bounds.height.toFixed(3)}`)

        // 先檢查是否有明顯的Z形特徵，如果有則大幅降分
        const zLikeFeatures = this.detectZLikeFeatures(points, bounds)
        // if (zLikeFeatures > 0.6) {
        //     console.log(`U/V形 - 檢測到強烈Z形特徵 (${zLikeFeatures.toFixed(2)})，大幅降分`)
        //     return Math.max(0, 0.3 - zLikeFeatures * 0.5) // 有Z特徵時大幅降分
        // }

        const weights = this.FEATURE_WEIGHTS.U
        let weightedScore = 0
        let totalWeight = 0

        // 1. 適度寬鬆的長寬比檢測（但排除明顯的Z形比例）
        const aspectRatio = bounds.width / bounds.height
        let ratioScore = 0
        if (aspectRatio > 0.2 && aspectRatio < 2.5) {
            // U/V形通常高度>=寬度，Z形通常寬度>高度
            if (aspectRatio < 1.5) {
                ratioScore = 1.0 // 偏向高的形狀
            } else if (aspectRatio < 2.0) {
                ratioScore = 0.7 // 稍寬的形狀
            } else {
                ratioScore = 0.4 // 很寬的形狀可能是Z
            }
        } else {
            ratioScore = 0.3
        }
        console.log(`U/V形 - 長寬比: ${aspectRatio.toFixed(2)}, 分數: ${ratioScore.toFixed(2)}, 權重: ${weights.aspectRatio}`)
        weightedScore += ratioScore * weights.aspectRatio
        totalWeight += weights.aspectRatio

        // 2. 更智能的開口檢測（支援各種起終點位置）
        const openScore = this.checkUVOpening(points, bounds)
        console.log(`U/V形 - 開口檢測分數: ${openScore.toFixed(2)}, 權重: ${weights.opening}`)
        weightedScore += openScore * weights.opening
        totalWeight += weights.opening

        // 3. 更靈活的底部/轉折點檢測
        const turnScore = this.checkUVTurningPoint(points, bounds)
        console.log(`U/V形 - 轉折點檢測分數: ${turnScore.toFixed(2)}, 權重: ${weights.turningPoint}`)
        weightedScore += turnScore * weights.turningPoint
        totalWeight += weights.turningPoint

        // 4. 改進的方向檢測（同時支援U和V）
        const directionScore = this.checkUVShapeDirection(points, bounds)
        console.log(`U/V形 - 方向檢測分數: ${directionScore.toFixed(2)}, 權重: ${weights.direction}`)
        weightedScore += directionScore * weights.direction
        totalWeight += weights.direction

        // 5. 檢測U/V特有的連續性（與Z的折線特徵區分）
        const continuityScore = this.checkUVContinuity(points)
        console.log(`U/V形 - 連續性檢測分數: ${continuityScore.toFixed(2)}, 權重: ${weights.continuity}`)
        weightedScore += continuityScore * weights.continuity
        totalWeight += weights.continuity

        // 6. 封閉性懲罰
        // const startPoint = points[0]
        // const endPoint = points[points.length - 1]
        // const closeness = this.distance(startPoint, endPoint)
        // // 修改封閉性懲罰：對於歸一化後的座標，使用更小的閾值
        // const isClosedPenalty = closeness < Math.min(bounds.width, bounds.height) * 0.15 ? 0.6 : 1.0
        // console.log(`U/V形 - 封閉懲罰: ${isClosedPenalty.toFixed(2)}, 權重: ${weights.closeness}`)
        // weightedScore *= isClosedPenalty

        // 7. Z形特徵懲罰
        // if (zLikeFeatures > 0.3) {
        //     const zPenalty = 1.0 - (zLikeFeatures - 0.3) * 0.7
        //     weightedScore *= zPenalty
        //     console.log(`U/V形 - Z形特徵懲罰: ${zPenalty.toFixed(2)}`)
        // }

        // 計算加權平均分數
        const finalScore = totalWeight > 0 ? weightedScore / totalWeight : 0
        console.log(`U/V形加權分數: ${weightedScore.toFixed(3)}/${totalWeight.toFixed(3)} = ${finalScore.toFixed(3)}`)
        return finalScore
    }

    // Z形檢測
    detectZ(points) {
        if (points.length < 5) return 0 // 降低最小點數要求

        const bounds = this.getBounds(points)
        // 修改邊界檢查：對於歸一化後的座標，使用更小的閾值
        const minSize = 0.1 // 歸一化後的最小尺寸要求
        if (bounds.width < minSize || bounds.height < minSize) return 0

        console.log(`Z形檢測 - 邊界: ${bounds.width.toFixed(3)} x ${bounds.height.toFixed(3)}`)

        const weights = this.FEATURE_WEIGHTS.Z
        let weightedScore = 0
        let totalWeight = 0

        // 1. 整體移動檢測
        const startPoint = points[0]
        const endPoint = points[points.length - 1]
        const deltaX = Math.abs(endPoint.X - startPoint.X)
        const deltaY = Math.abs(endPoint.Y - startPoint.Y)

        // 修改移動檢測：對於歸一化後的座標，使用更小的閾值
        const hasMovement = deltaX > bounds.width * 0.15 || deltaY > bounds.height * 0.15
        const movementScore = hasMovement ? 1.0 : 0.5
        console.log(`Z形 - 整體移動: ΔX=${deltaX.toFixed(3)}, ΔY=${deltaY.toFixed(3)}, 分數: ${movementScore.toFixed(2)}, 權重: ${weights.movement}`)
        weightedScore += movementScore * weights.movement
        totalWeight += weights.movement

        // 2. 更寬鬆的方向變化檢測
        const directionChanges = this.analyzeDirectionChanges(points)
        const changeScore = directionChanges.count >=2 && directionChanges.count <= 4 ? 1.0 : 0.3
        console.log(`Z形 - 方向變化: ${directionChanges.count}次, 分數: ${changeScore.toFixed(2)}, 權重: ${weights.directionChanges}`)
        weightedScore += changeScore * weights.directionChanges
        totalWeight += weights.directionChanges

        // 3. 更靈活的Z字型路徑檢測
        const zPatternScore = this.checkFlexibleZPattern(points, bounds)
        console.log(`Z形 - 靈活Z字型模式: ${zPatternScore.toFixed(2)}, 權重: ${weights.zPattern}`)
        weightedScore += zPatternScore * weights.zPattern
        totalWeight += weights.zPattern

        // 4. 更寬鬆的線性度檢測
        const linearityScore = this.checkModerateLinearity(points)
        console.log(`Z形 - 適度線性度: ${linearityScore.toFixed(2)}, 權重: ${weights.linearity}`)
        weightedScore += linearityScore * weights.linearity
        totalWeight += weights.linearity

        // 5. 更寬鬆的排除條件（懲罰項）
        let penalty = 1.0

        // 更寬鬆的封閉性檢測
        const closeness = this.distance(startPoint, endPoint)
        const maxDimension = Math.max(bounds.width, bounds.height)
        if (closeness < maxDimension * 0.1) {
            penalty *= 0.7 // 原本是0.5，現在改為0.7
            console.log(`Z形 - 過於封閉，懲罰: ${penalty}`)
        }

        // 圓滑度檢測
        const smoothness = this.calculateSmoothness(points)
        if (smoothness > 0.9) {
            penalty *= 0.8 // 原本是0.6，現在改為0.8
            console.log(`Z形 - 過於圓滑，懲罰: ${penalty}`)
        }

        // 6. 質量加分
        const qualityBonus = this.assessZigzagQuality(points, bounds)

        // 計算加權平均分數
        const baseScore = totalWeight > 0 ? weightedScore / totalWeight : 0
        const finalScore = Math.min(1.0, baseScore * penalty * qualityBonus)
        console.log(`Z形最終計算: 基礎${baseScore.toFixed(3)} × 懲罰${penalty.toFixed(3)} × 加分${qualityBonus.toFixed(3)} = ${finalScore.toFixed(3)}`)
        
        return finalScore
    }

    // === 新增的Z形特徵檢測函數 ===

    // 檢測明顯的Z形特徵（用於在U檢測中排除） - 調整為更精確
    detectZLikeFeatures(points, bounds) {
        let zScore = 0
        // let featureCount = 0

        // 1. 檢測橫向為主的移動（Z形特徵） - 調整閾值
        const startPoint = points[0]
        const endPoint = points[points.length - 1]
        const horizontalMovement = Math.abs(endPoint.X - startPoint.X)
        const verticalMovement = Math.abs(endPoint.Y - startPoint.Y)

        // 只有在水平移動明顯大於垂直移動時才認為是Z特徵
        if (horizontalMovement > verticalMovement * 2.0) { // 提高閾值從1.2到2.0
            zScore += 0.4
            console.log(`檢測到強橫向主導移動 (Z特徵) - H:${horizontalMovement.toFixed(3)}, V:${verticalMovement.toFixed(3)}`)
        } else if (horizontalMovement > verticalMovement * 1.5) { // 中等橫向主導
            zScore += 0.2
            console.log(`檢測到中等橫向主導移動`)
        }
        // featureCount++

        // 2. 檢測急轉彎（Z形的角特徵） - 提高閾值
        const sharpTurns = this.countSharpTurns(points)
        if (sharpTurns >= 3) { // 提高閾值從2到3
            zScore += 0.4
            console.log(`檢測到${sharpTurns}個急轉彎 (強Z特徵)`)
        } else if (sharpTurns >= 2) {
            zScore += 0.2
            console.log(`檢測到${sharpTurns}個急轉彎 (中等Z特徵)`)
        }
        // featureCount++

        // 3. 檢測線性段落（Z形有明顯直線段） - 提高閾值
        // const linearSegments = this.countLinearSegments(points)
        // const linearRatio = linearSegments / Math.max(1, points.length / 3)
        // if (linearRatio > 0.8) { // 提高閾值從0.6到0.8
        //     zScore += 0.3
        //     console.log(`檢測到高線性度 ${linearRatio.toFixed(2)} (Z特徵)`)
        // } else if (linearRatio > 0.6) {
        //     zScore += 0.15
        //     console.log(`檢測到中等線性度 ${linearRatio.toFixed(2)}`)
        // }
        // featureCount++

        // 4. 新增：檢測Z形的折線特徵（多個明顯的方向變化）
        const directionChanges = this.analyzeDirectionChanges(points)
        if (directionChanges.count == 2) { // Z形通常有多個方向變化
            zScore += 0.3
            console.log(`檢測到多次方向變化 (${directionChanges.count}次, Z特徵)`)
        }
        // featureCount++

        console.log(`Z特徵總分: ${zScore.toFixed(2)}`)
        return zScore
    }

    checkIfZLikeOpening(startX, startY, endX, endY) {
        // Z字特徵：對角線分佈，且跨越大範圍
        const diagonalMovement = Math.abs(endX - startX) + Math.abs(endY - startY)
        const isDiagonal = diagonalMovement > 1.2 // 對角線跨度很大
        
        // Z字通常是從一個角落到另一個角落
        const isCornerToCorner = 
            (startX < 0.4 && startY < 0.4 && endX > 0.6 && endY > 0.6) || // 左上到右下
            (startX < 0.4 && startY > 0.6 && endX > 0.6 && endY < 0.4) || // 左下到右上
            (startX > 0.6 && startY < 0.4 && endX < 0.4 && endY > 0.6) || // 右上到左下
            (startX > 0.6 && startY > 0.6 && endX < 0.4 && endY < 0.4)    // 右下到左上
        
        return isDiagonal && isCornerToCorner
    }

    assessZigzagQuality(points, bounds) {
        let qualityBonus = 1.0
        
        // 1. 檢查Z字的典型路徑
        const pathType = this.identifyZigzagPath(points, bounds)
        switch (pathType) {
            case 'classic_z':      // 左上→右上→左下→右下
                qualityBonus = 1.2
                console.log(`Z形 - 檢測到經典Z字路徑，加分: ${qualityBonus}`)
                break
            case 'reverse_z':      // 右上→左上→右下→左下
                qualityBonus = 1.15
                console.log(`Z形 - 檢測到反向Z字路徑，加分: ${qualityBonus}`)
                break
            case 'diagonal_z':     // 斜向Z字
                qualityBonus = 1.1
                console.log(`Z形 - 檢測到斜向Z字路徑，加分: ${qualityBonus}`)
                break
            default:
                qualityBonus = 1.0
        }
        
        // 2. 檢查角度變化的清晰度
        const angleChanges = this.analyzeAngleChanges(points).angleChanges
        if (angleChanges.hasSharpTurns && angleChanges.hasStraightSegments) {
            qualityBonus *= 1.1
            console.log(`Z形 - 有清晰的轉角和直線段，額外加分`)
        }
        
        return qualityBonus
    }
    
    identifyZigzagPath(points, bounds) {
        const segments = this.divideIntoSegments(points, 4)
        if (segments.length < 3) return 'unknown'
        
        const directions = segments.map(seg => this.getSegmentDirection(seg))
        
        // 檢查經典Z字模式：右→左下→右
        const isClassicZ = 
            directions[0].x > 0.5 &&                    // 向右
            directions[1].x < -0.3 && directions[1].y > 0.3 && // 向左下
            directions[2].x > 0.5                       // 向右
        
        if (isClassicZ) return 'classic_z'
        
        // 檢查其他模式...
        return 'unknown'
    }

    analyzeAngleChanges(points) {
        if (points.length < 6) {
            return {
                hasSharpTurns: false,
                hasStraightSegments: false,
                averageAngleChange: 0,
                maxAngleChange: 0,
                sharpTurnCount: 0,
                straightSegmentCount: 0,
                angleDistribution: []
            }
        }
    
        const angleChanges = []
        let totalAngleChange = 0
        let maxAngleChange = 0
        let sharpTurnCount = 0
        let straightSegmentCount = 0
        
        // 使用動態窗口大小，避免噪音
        const windowSize = Math.max(2, Math.min(4, Math.floor(points.length / 10)))
        
        for (let i = windowSize; i < points.length - windowSize; i++) {
            const p1 = points[i - windowSize]
            const p2 = points[i]
            const p3 = points[i + windowSize]
            
            // 計算兩個方向向量
            const dir1 = Math.atan2(p2.Y - p1.Y, p2.X - p1.X)
            const dir2 = Math.atan2(p3.Y - p2.Y, p3.X - p2.X)
            
            // 計算角度變化（0到π之間）
            let angleDiff = Math.abs(dir1 - dir2)
            if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff
            
            angleChanges.push({
                position: i,
                angle: angleDiff,
                degrees: angleDiff * 180 / Math.PI
            })
            
            totalAngleChange += angleDiff
            maxAngleChange = Math.max(maxAngleChange, angleDiff)
            
            // 分類角度變化
            if (angleDiff > Math.PI * 0.4) { // 大於72度算急轉彎
                sharpTurnCount++
            } else if (angleDiff < Math.PI * 0.1) { // 小於18度算直線段
                straightSegmentCount++
            }
        }
        
        const validPoints = angleChanges.length
        const averageAngleChange = validPoints > 0 ? totalAngleChange / validPoints : 0
        
        // 分析角度分佈
        const angleDistribution = this.analyzeAngleDistribution(angleChanges)
        
        // 判斷特徵
        const hasSharpTurns = sharpTurnCount >= 2 && (sharpTurnCount / validPoints) > 0.15
        const hasStraightSegments = straightSegmentCount >= 3 && (straightSegmentCount / validPoints) > 0.3
        
        console.log(`角度變化分析:`)
        console.log(`  平均角變: ${(averageAngleChange * 180 / Math.PI).toFixed(1)}°`)
        console.log(`  最大角變: ${(maxAngleChange * 180 / Math.PI).toFixed(1)}°`)
        console.log(`  急轉彎: ${sharpTurnCount}個 (${(sharpTurnCount/validPoints*100).toFixed(1)}%)`)
        console.log(`  直線段: ${straightSegmentCount}個 (${(straightSegmentCount/validPoints*100).toFixed(1)}%)`)
        console.log(`  有急轉彎: ${hasSharpTurns}, 有直線段: ${hasStraightSegments}`)
        
        return {
            hasSharpTurns,
            hasStraightSegments,
            averageAngleChange,
            maxAngleChange,
            sharpTurnCount,
            straightSegmentCount,
            angleDistribution,
            angleChanges, // 詳細的角度變化數據
            validPoints
        }
    }
    
    // 輔助函數：分析角度分佈
    analyzeAngleDistribution(angleChanges) {
        const distribution = {
            verySharp: 0,    // > 90度
            sharp: 0,        // 45-90度
            moderate: 0,     // 18-45度
            gentle: 0,       // 5-18度
            straight: 0      // < 5度
        }
        
        for (let change of angleChanges) {
            const degrees = change.degrees
            if (degrees > 90) {
                distribution.verySharp++
            } else if (degrees > 45) {
                distribution.sharp++
            } else if (degrees > 18) {
                distribution.moderate++
            } else if (degrees > 5) {
                distribution.gentle++
            } else {
                distribution.straight++
            }
        }
        
        return distribution
    }

    // 新增Z字模式檢測
    detectZigzagPattern(directions) {
    if (directions.length < 3) return false
    
    // 檢查是否有：水平→斜向→水平 的模式
    const angles = directions.map(dir => Math.atan2(dir.y, dir.x) * 180 / Math.PI)
    
    let hasHorizontalStart = false
    let hasDiagonalMiddle = false  
    let hasHorizontalEnd = false
    
    // 檢查開始段是否接近水平
    if (Math.abs(angles[0]) < 30 || Math.abs(angles[0] - 180) < 30) {
        hasHorizontalStart = true
    }
    
    // 檢查中間段是否有斜向
    for (let i = 1; i < directions.length - 1; i++) {
        const angle = Math.abs(angles[i])
        if (angle > 45 && angle < 135) {
            hasDiagonalMiddle = true
            break
        }
    }
    
    // 檢查結束段是否接近水平
    const lastAngle = angles[angles.length - 1]
    if (Math.abs(lastAngle) < 30 || Math.abs(lastAngle - 180) < 30) {
        hasHorizontalEnd = true
        }

        return hasHorizontalStart && hasDiagonalMiddle && hasHorizontalEnd
    }

    // 檢測U/V的連續性特徵（與Z的折線區分）
    checkUVContinuity(points) {
        if (points.length < 4) return 0.5

        // 計算路徑的平滑度
        let totalAngleChange = 0
        let maxAngleChange = 0
        let validPoints = 0

        for (let i = 2; i < points.length - 2; i++) {
            const p1 = points[i - 2]
            const p2 = points[i]
            const p3 = points[i + 2]

            const angle1 = Math.atan2(p2.Y - p1.Y, p2.X - p1.X)
            const angle2 = Math.atan2(p3.Y - p2.Y, p3.X - p2.X)
            let angleDiff = Math.abs(angle1 - angle2)
            if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff

            totalAngleChange += angleDiff
            maxAngleChange = Math.max(maxAngleChange, angleDiff)
            validPoints++
        }

        if (validPoints === 0) return 0.5

        const avgAngleChange = totalAngleChange / validPoints

        // U/V形應該有較平滑的轉向，不像Z形有急轉彎
        let continuityScore = 0

        // 平均角度變化較小表示連續性好
        if (avgAngleChange < Math.PI / 6) { // 30度以下
            continuityScore += 0.5
        } else if (avgAngleChange < Math.PI / 4) { // 45度以下
            continuityScore += 0.3
        }

        // 最大角度變化不太大表示沒有急轉彎
        if (maxAngleChange < Math.PI / 3) { // 60度以下
            continuityScore += 0.5
        } else if (maxAngleChange < Math.PI / 2) { // 90度以下
            continuityScore += 0.3
        }

        console.log(`連續性檢測 - 平均角變: ${(avgAngleChange * 180 / Math.PI).toFixed(1)}°, 最大角變: ${(maxAngleChange * 180 / Math.PI).toFixed(1)}°`)

        return Math.min(1.0, continuityScore)
    }

    // 計算急轉彎數量
    countSharpTurns(points) {
        let sharpTurns = 0
        const threshold = Math.PI * 0.4 // 72度

        for (let i = 3; i < points.length - 3; i++) {
            const p1 = points[i - 3]
            const p2 = points[i]
            const p3 = points[i + 3]

            const angle1 = Math.atan2(p2.Y - p1.Y, p2.X - p1.X)
            const angle2 = Math.atan2(p3.Y - p2.Y, p3.X - p2.X)
            let angleDiff = Math.abs(angle1 - angle2)
            if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff

            if (angleDiff > threshold) {
                sharpTurns++
            }
        }
        return sharpTurns
    }

    // 計算線性段落數量
    countLinearSegments(points) {
        let linearCount = 0
        const threshold = 0.1 // 很小的角度變化

        for (let i = 2; i < points.length - 2; i++) {
            const p1 = points[i - 2]
            const p2 = points[i]
            const p3 = points[i + 2]

            const angle1 = Math.atan2(p2.Y - p1.Y, p2.X - p1.X)
            const angle2 = Math.atan2(p3.Y - p2.Y, p3.X - p2.X)
            let angleDiff = Math.abs(angle1 - angle2)
            if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff

            if (angleDiff < threshold) {
                linearCount++
            }
        }
        return linearCount
    }

    // 檢測U/V形的開口特徵 - 大幅改進V字識別
    checkUVOpening(points, bounds) {
        const startPoint = points[0]
        const endPoint = points[points.length - 1]

        // 計算起終點的相對位置
        const startY = (startPoint.Y - bounds.minY) / bounds.height
        const endY = (endPoint.Y - bounds.minY) / bounds.height
        const startX = (startPoint.X - bounds.minX) / bounds.width
        const endX = (endPoint.X - bounds.minX) / bounds.width
        console.log(`開口檢測 - 起點: (${startX.toFixed(2)}, ${startY.toFixed(2)}), 終點: (${endX.toFixed(2)}, ${endY.toFixed(2)})`)

        // 排除明顯的Z字開口特徵
        const isZLikeOpening = this.checkIfZLikeOpening(startX, startY, endX, endY)
        if (isZLikeOpening) {
            console.log(`檢測到Z字型開口特徵，降低U/V形開口分數`)
            return 0.3 // 大幅降分
        }

        // 檢查多種可能的開口模式
        let bestScore = 0

        // 1. 標準V形：起終點都在上方，左右分開
        if (startY < 0.7 && endY < 0.7) {
            const horizontalSeparation = Math.abs(endX - startX)
            if (horizontalSeparation > 0.2) {
                bestScore = Math.max(bestScore, 1.0)
                console.log(`檢測到標準V形開口 - 水平分離: ${horizontalSeparation.toFixed(2)}`)
            } else if (horizontalSeparation > 0.1) {
                bestScore = Math.max(bestScore, 0.8)
                console.log(`檢測到窄V形開口`)
            }
        }

        // 2. 寬鬆V形：起終點在上半部或中部
        if (startY < 0.8 && endY < 0.8) {
            bestScore = Math.max(bestScore, 0.8)
            console.log(`檢測到寬鬆V形開口`)
        }

        // 3. 經典U形：起終點都在上方，但可能比較接近
        if (startY < 0.6 && endY < 0.6) {
            bestScore = Math.max(bestScore, 0.9)
            console.log(`檢測到經典U形開口`)
        }

        // 4. 倒V形：起終點都在下方
        if (startY > 0.3 && endY > 0.3) {
            bestScore = Math.max(bestScore, 0.9)
            console.log(`檢測到倒V形開口`)
        }

        // 5. 側開口：起終點在左右兩側
        if ((startX < 0.3 && endX > 0.7) || (startX > 0.7 && endX < 0.3)) {
            bestScore = Math.max(bestScore, 0.8)
            console.log(`檢測到側開口U/V形`)
        }

        // 6. 任何有明顯分離的起終點
        const totalSeparation = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2))
        if (totalSeparation > 0.3) {
            bestScore = Math.max(bestScore, 0.7)
            console.log(`檢測到明顯分離的起終點 - 分離度: ${totalSeparation.toFixed(2)}`)
        }

        // 7. 基礎開口特徵（很寬鬆）
        if (Math.abs(startY - endY) < 0.5 || totalSeparation > 0.15) {
            bestScore = Math.max(bestScore, 0.6)
            console.log(`檢測到基礎開口特徵`)
        }

        return bestScore > 0 ? bestScore : 0.4 // 最低給0.4分
    }

    // 檢測U/V形的轉折點 - 特別針對V字優化
    checkUVTurningPoint(points, bounds) {
        // 找出Y軸的極值點（最高和最低）
        let minY = Infinity, maxY = -Infinity
        let minYIndex = 0, maxYIndex = 0

        for (let i = 0; i < points.length; i++) {
            if (points[i].Y < minY) {
                minY = points[i].Y
                minYIndex = i
            }
            if (points[i].Y > maxY) {
                maxY = points[i].Y
                maxYIndex = i
            }
        }

        const totalPoints = points.length

        // V形關鍵特徵：最低點（底點）應該在中間區域
        const bottomPointRatio = maxYIndex / totalPoints
        console.log(`轉折點檢測 - 最低點位置比例: ${bottomPointRatio.toFixed(2)}`)

        let bestScore = 0

        // 1. 檢查是否有明顯的轉向（不管位置）
        const hasSignificantTurn = this.hasSignificantDirectionChange(points)
        if (hasSignificantTurn) {
            bestScore = Math.max(bestScore, 0.6)
            console.log(`bestScore: ${bestScore}, 檢測到明顯方向轉換`)
        }

        // 2. 標準V形：最低點在中間30-70%區域
        if (bottomPointRatio > 0.3 && bottomPointRatio < 0.7) {
            bestScore = Math.max(bestScore, 1.0)
            console.log(`bestScore: ${bestScore}, 檢測到標準V形轉折點`)
        }

        // 3. 寬鬆V形：最低點在中間20-80%區域
        if (bottomPointRatio > 0.2 && bottomPointRatio < 0.8) {
            bestScore = Math.max(bestScore, 0.7)
            console.log(`bestScore: ${bestScore}, 檢測到寬鬆V形轉折點`)
        }

        // 4. 很寬鬆V形：最低點在中間10-90%區域
        if (bottomPointRatio > 0.1 && bottomPointRatio < 0.9) {
            bestScore = Math.max(bestScore, 0.3)
            console.log(`bestScore: ${bestScore}, 檢測到很寬鬆V形轉折點`)
        }

        // 5. U形：最低點在中間區域（與V形重疊但稍寬）
        if (bottomPointRatio > 0.25 && bottomPointRatio < 0.75) {
            bestScore = Math.max(bestScore, 0.9)
            console.log(`bestScore: ${bestScore}, 檢測到U形轉折點`)
        }

        // 6. 倒U形：最高點在中間
        const topPointRatio = minYIndex / totalPoints
        if (topPointRatio > 0.2 && topPointRatio < 0.8) {
            bestScore = 0.1//Math.max(bestScore, 0.1)
            console.log(`bestScore: ${bestScore}, 檢測到倒U形轉折點`)
        }

        return bestScore > 0 ? bestScore : 0.3 // 最低給0.5分
    }

    // 新增：檢測是否有明顯的方向轉換
    hasSignificantDirectionChange(points) {
        if (points.length < 6) return false

        const third = Math.floor(points.length / 3)
        const firstPart = points.slice(0, third)
        const lastPart = points.slice(-third)

        if (firstPart.length < 2 || lastPart.length < 2) return false

        // 計算第一段和最後段的方向
        const firstDir = this.getSegmentDirection(firstPart)
        const lastDir = this.getSegmentDirection(lastPart)

        // 計算方向差異
        const angle1 = Math.atan2(firstDir.y, firstDir.x)
        const angle2 = Math.atan2(lastDir.y, lastDir.x)
        let angleDiff = Math.abs(angle1 - angle2)
        if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff

        // 如果方向變化超過45度，認為有明顯轉向
        return angleDiff > Math.PI / 4
    }

    // === 改進的輔助檢測函數 ===

    // 更寬鬆的直線段檢測
    countStraightSegments(points) {
        let straightCount = 0
        const threshold = 0.2 // 進一步放寬角度變化閾值

        for (let i = 2; i < points.length - 2; i++) {
            const p1 = points[i - 2]
            const p2 = points[i]
            const p3 = points[i + 2]

            const angle1 = Math.atan2(p2.Y - p1.Y, p2.X - p1.X)
            const angle2 = Math.atan2(p3.Y - p2.Y, p3.X - p2.X)
            let angleDiff = Math.abs(angle1 - angle2)
            if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff

            if (angleDiff < threshold) {
                straightCount++
            }
        }
        return straightCount
    }

    // 尖角檢測
    hasSharpCorners(points) {
        const threshold = Math.PI * 0.5
        let sharpCorners = 0

        for (let i = 3; i < points.length - 3; i++) {
            const p1 = points[i - 3]
            const p2 = points[i]
            const p3 = points[i + 3]

            const angle1 = Math.atan2(p2.Y - p1.Y, p2.X - p1.X)
            const angle2 = Math.atan2(p3.Y - p2.Y, p3.X - p2.X)
            let angleDiff = Math.abs(angle1 - angle2)
            if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff

            if (angleDiff > threshold) {
                sharpCorners++
            }
        }
        return sharpCorners > 3
    }

    // 改進的U/V形方向檢測 - 特別加強V字識別
    checkUVShapeDirection(points, bounds) {
        const segments = Math.max(3, Math.floor(points.length / 4))
        if (segments < 2) return 0.7 // 點數太少時給較高基礎分

        const segmentSize = Math.floor(points.length / segments)
        const directions = []

        // 計算每段的方向
        for (let i = 0; i < segments; i++) {
            const start = i * segmentSize
            const end = i === segments - 1 ? points.length : (i + 1) * segmentSize
            const segment = points.slice(start, end)
            if (segment.length >= 2) {
                directions.push(this.getSegmentDirection(segment))
            }
        }

        if (directions.length < 2) return 0.7

        console.log(`方向檢測 - 總段數: ${directions.length}`)
        directions.forEach((dir, i) => {
            const angle = Math.atan2(dir.y, dir.x) * 180 / Math.PI
            console.log(`  段${i}: 方向角度 ${angle.toFixed(1)}°, 向量(${dir.x.toFixed(2)}, ${dir.y.toFixed(2)})`)
        })

        // 檢測各種U/V形模式
        let bestScore = 0

        // === V形模式檢測 (特別加強) ===

        // 模式1：標準V形 - 向下左斜 → 向下右斜
        if (directions.length >= 2) {
            const firstDir = directions[0]
            const lastDir = directions[directions.length - 1]

            // 檢查是否都有向下的趨勢
            const firstDown = firstDir.y > 0.1
            const lastDown = lastDir.y > 0.1

            // 檢查X方向是否相反（一左一右）
            const oppositeX = (firstDir.x > 0.1 && lastDir.x < -0.1) || (firstDir.x < -0.1 && lastDir.x > 0.1)

            if (firstDown && lastDown && oppositeX) {
                bestScore = Math.max(bestScore, 1.0)
                console.log(`🎯 檢測到標準V形模式：向下左斜→向下右斜`)
            }

            // 寬鬆版本：只要有相反的X方向趨勢
            if (oppositeX) {
                bestScore = Math.max(bestScore, 0.9)
                console.log(`🎯 檢測到V形X方向相反模式`)
            }
        }

        // 模式2：三段式V形 - 左下 → 下 → 右下
        if (directions.length >= 3) {
            const firstDir = directions[0]
            const middleDir = directions[1]
            const lastDir = directions[directions.length - 1]

            const firstLeftDown = firstDir.x < 0 && firstDir.y > 0.05
            const middleDown = Math.abs(middleDir.x) < 0.5 && middleDir.y > 0.05
            const lastRightDown = lastDir.x > 0 && lastDir.y > 0.05

            if (firstLeftDown && middleDown && lastRightDown) {
                bestScore = Math.max(bestScore, 1.0)
                console.log(`🎯 檢測到三段式V形模式：左下→下→右下`)
            }
        }

        // 模式3：簡化V形 - 只要第一段和最後段有明顯不同方向
        if (directions.length >= 2) {
            const firstDir = directions[0]
            const lastDir = directions[directions.length - 1]

            const angleDiff = Math.abs(
                Math.atan2(firstDir.y, firstDir.x) - Math.atan2(lastDir.y, lastDir.x)
            )
            const normalizedAngleDiff = angleDiff > Math.PI ? 2 * Math.PI - angleDiff : angleDiff

            if (normalizedAngleDiff > Math.PI / 4) { // 45度以上的方向差異
                bestScore = Math.max(bestScore, 0.8)
                console.log(`🎯 檢測到顯著方向變化: ${(normalizedAngleDiff * 180 / Math.PI).toFixed(1)}°`)
            }
        }

        // === U形模式檢測 ===

        // 模式4：經典U形 - 向下 → 水平 → 向上
        if (directions.length >= 3) {
            const firstDir = directions[0]
            const middleDir = directions[Math.floor(directions.length / 2)]
            const lastDir = directions[directions.length - 1]

            const firstDown = firstDir.y > 0.15
            const middleHorizontal = Math.abs(middleDir.y) < 0.4
            const lastUp = lastDir.y < -0.15

            if (firstDown && middleHorizontal && lastUp) {
                bestScore = Math.max(bestScore, 1.0)
                console.log(`🎯 檢測到經典U形模式：向下→水平→向上`)
            }
        }

        // 模式5：簡化U形 - 向下後向上
        if (directions.length >= 2) {
            const firstDir = directions[0]
            const lastDir = directions[directions.length - 1]

            const firstDown = firstDir.y > 0.1
            const lastUp = lastDir.y < -0.1

            if (firstDown && lastUp) {
                bestScore = Math.max(bestScore, 0.9)
                console.log(`🎯 檢測到簡化U形模式：向下→向上`)
            }
        }

        // === 其他模式 ===

        // 模式6：倒U形或倒V形
        if (directions.length >= 2) {
            const firstDir = directions[0]
            const lastDir = directions[directions.length - 1]

            const firstUp = firstDir.y < -0.1
            const lastDown = lastDir.y > 0.1

            if (firstUp && lastDown) {
                bestScore = Math.max(bestScore, 0.8)
                console.log(`🎯 檢測到倒U/V形模式：向上→向下`)
            }
        }

        // 模式7：任何有轉向的模式（最寬鬆）
        let hasAnyTurn = false
        for (let i = 1; i < directions.length; i++) {
            const prevDir = directions[i - 1]
            const currDir = directions[i]

            const dotProduct = prevDir.x * currDir.x + prevDir.y * currDir.y
            if (dotProduct < 0.5) { // 方向變化大於60度
                hasAnyTurn = true
                break
            }
        }

        if (hasAnyTurn) {
            bestScore = Math.max(bestScore, 0.7)
            console.log(`🎯 檢測到基本轉向模式`)
        }

        // 如果什麼都沒檢測到，給基礎分數
        if (bestScore === 0) {
            bestScore = 0.3
            console.log(`⚠️ 無明顯U/V模式，給基礎分數`)
        }

        return bestScore
    }

    // 更寬鬆的方向變化分析
    analyzeDirectionChanges(points) {
        const changes = []
        const smoothingWindow = Math.max(2, Math.floor(points.length / 12)) // 減小窗口

        for (let i = smoothingWindow; i < points.length - smoothingWindow; i += smoothingWindow) {
            const p1 = points[i - smoothingWindow]
            const p2 = points[i]
            const p3 = points[i + smoothingWindow]

            const dir1 = Math.atan2(p2.Y - p1.Y, p2.X - p1.X)
            const dir2 = Math.atan2(p3.Y - p2.Y, p3.X - p2.X)

            let angleDiff = Math.abs(dir1 - dir2)
            if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff

            // 降低角度要求到20度
            if (angleDiff > Math.PI / 9) {
                changes.push({
                    position: i,
                    angle: angleDiff
                })
            }
        }

        return {
            count: changes.length,
            changes: changes
        }
    }

    // 更寬鬆的Z字型模式檢測
    checkFlexibleZPattern(points, bounds) {
        if (points.length < 4) return 0

        const segmentCount = Math.min(4, Math.floor(points.length / 2))
        const segments = this.divideIntoSegments(points, segmentCount)

        let patternScore = 0
        let hasAngularMovement = false
        let hasDirectionReversal = false

        const directions = segments.map(segment => this.getSegmentDirection(segment))

        // 1. 更寬鬆的角度變化檢測
        for (let i = 1; i < directions.length; i++) {
            const prevDir = directions[i - 1]
            const currDir = directions[i]

            const angleDiff = Math.abs(Math.atan2(currDir.y, currDir.x) - Math.atan2(prevDir.y, prevDir.x))
            const normalizedAngle = angleDiff > Math.PI ? 2 * Math.PI - angleDiff : angleDiff

            if (normalizedAngle > Math.PI / 6) { // 降低到30度
                hasAngularMovement = true
            }
        }

        // 2. 更寬鬆的方向反轉檢測
        if (directions.length >= 2) {
            const firstDir = directions[0]
            const lastDir = directions[directions.length - 1]

            const xReversal = Math.abs(firstDir.x - lastDir.x) > 0.3 // 降低要求
            const yReversal = Math.abs(firstDir.y - lastDir.y) > 0.3 // 降低要求

            if (xReversal || yReversal) {
                hasDirectionReversal = true
            }
        }

        // 3. 更寬鬆的覆蓋範圍檢測
        const coverageX = bounds.width / Math.max(bounds.width, bounds.height)
        const coverageY = bounds.height / Math.max(bounds.width, bounds.height)
        const hasCoverage = coverageX > 0.2 && coverageY > 0.2 // 降低要求

        // 計算分數
        if (hasAngularMovement) {
            patternScore += 0.4
            console.log(`Z形 - 檢測到角度變化`)
        }

        if (hasDirectionReversal) {
            patternScore += 0.4
            console.log(`Z形 - 檢測到方向反轉`)
        }

        if (hasCoverage) {
            patternScore += 0.3
            console.log(`Z形 - 檢測到良好覆蓋範圍`)
        }

        // 額外分數：簡單的兩段式Z字
        if (directions.length >= 2) {
            patternScore += 0.2
            console.log(`Z形 - 基本兩段式模式`)
        }

        return Math.min(1.0, patternScore)
    }

    // 更寬鬆的線性度檢測
    checkModerateLinearity(points) {
        if (points.length < 4) return 0.5

        const segments = this.divideIntoSegments(points, Math.min(3, Math.floor(points.length / 3)))
        let linearitySum = 0
        let validSegments = 0

        for (let segment of segments) {
            if (segment.length < 2) continue

            const start = segment[0]
            const end = segment[segment.length - 1]
            const idealLine = this.distance(start, end)

            let actualPath = 0
            for (let i = 1; i < segment.length; i++) {
                actualPath += this.distance(segment[i - 1], segment[i])
            }

            const efficiency = actualPath > 0 ? idealLine / actualPath : 0

            // 更寬鬆的線性度要求
            if (efficiency > 0.3) {
                linearitySum += efficiency
                validSegments++
            }
        }

        if (validSegments === 0) return 0.5

        const avgLinearity = linearitySum / validSegments

        // 更寬鬆的評分標準
        if (avgLinearity >= 0.4) {
            return 1.0
        } else if (avgLinearity >= 0.3) {
            return 0.8
        } else {
            return 0.6
        }
    }

    // 基礎輔助函數保持不變
    getBounds(points) {
        let minX = Infinity, maxX = -Infinity
        let minY = Infinity, maxY = -Infinity

        for (let p of points) {
            minX = Math.min(minX, p.X)
            maxX = Math.max(maxX, p.X)
            minY = Math.min(minY, p.Y)
            maxY = Math.max(maxY, p.Y)
        }

        return {
            minX, maxX, minY, maxY,
            width: maxX - minX,
            height: maxY - minY
        }
    }

    distance(p1, p2) {
        return Math.sqrt((p2.X - p1.X) ** 2 + (p2.Y - p1.Y) ** 2)
    }

    divideIntoSegments(points, segmentCount) {
        const segments = []
        const segmentSize = Math.floor(points.length / segmentCount)

        for (let i = 0; i < segmentCount; i++) {
            const start = i * segmentSize
            const end = i === segmentCount - 1 ? points.length : (i + 1) * segmentSize
            segments.push(points.slice(start, end))
        }

        return segments
    }

    getSegmentDirection(segment) {
        if (segment.length < 2) return { x: 0, y: 0 }

        const start = segment[0]
        const end = segment[segment.length - 1]
        const deltaX = end.X - start.X
        const deltaY = end.Y - start.Y
        const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

        return length > 0 ? { x: deltaX / length, y: deltaY / length } : { x: 0, y: 0 }
    }

    calculateSmoothness(points) {
        if (points.length < 5) return 0
    
        // 根據軌跡長度動態調整採樣距離
        const sampleDistance = Math.max(1, Math.min(5, Math.floor(points.length / 15)))
        console.log(`平滑度檢測 - 採樣距離: ${sampleDistance}`)
    
        let totalCurvature = 0
        let validPoints = 0
        let angleChangeDistribution = { small: 0, medium: 0, large: 0 }
    
        for (let i = sampleDistance; i < points.length - sampleDistance; i++) {
            const p1 = points[i - sampleDistance]
            const p2 = points[i]
            const p3 = points[i + sampleDistance]
    
            const angle1 = Math.atan2(p2.Y - p1.Y, p2.X - p1.X)
            const angle2 = Math.atan2(p3.Y - p2.Y, p3.X - p2.X)
            let angleDiff = Math.abs(angle1 - angle2)
            if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff
    
            // 改進的平滑度計算，對小角度變化不那麼敏感
            const smoothnessContribution = this.calculateAngleSmoothness(angleDiff)
            totalCurvature += smoothnessContribution
            validPoints++
    
            // 統計角度變化分佈
            this.categorizeAngleChange(angleDiff, angleChangeDistribution)
        }
    
        const averageSmoothness = validPoints > 0 ? totalCurvature / validPoints : 0
        
        // 根據角度變化分佈調整結果
        const adjustedSmoothness = this.adjustSmoothnessBasedOnDistribution(
            averageSmoothness, 
            angleChangeDistribution, 
            validPoints
        )
    
        console.log(`平滑度分析 - 原始: ${averageSmoothness.toFixed(3)}, 調整後: ${adjustedSmoothness.toFixed(3)}`)
        return adjustedSmoothness
    }

    calculateAngleSmoothness(angleDiff) {
        const degrees = angleDiff * 180 / Math.PI
        
        // 使用分段函數，對小角度變化更寬容
        if (degrees < 10) {
            // 10度以下認為是非常平滑的
            return 1.0
        } else if (degrees < 30) {
            // 10-30度線性減少
            return 1.0 - (degrees - 10) / 20 * 0.2  // 從1.0降到0.8
        } else if (degrees < 90) {
            // 30-90度較快減少
            return 0.8 - (degrees - 30) / 60 * 0.6  // 從0.8降到0.2
        } else {
            // 90度以上認為是急轉彎
            return Math.max(0, 0.2 - (degrees - 90) / 90 * 0.2)  // 從0.2降到0
        }
    }

    categorizeAngleChange(angleDiff, distribution) {
        const degrees = angleDiff * 180 / Math.PI
        
        if (degrees < 15) {
            distribution.small++
        } else if (degrees < 45) {
            distribution.medium++
        } else {
            distribution.large++
        }
    }
    
    adjustSmoothnessBasedOnDistribution(baseSmoothness, distribution, totalPoints) {
        const smallRatio = distribution.small / totalPoints
        const mediumRatio = distribution.medium / totalPoints
        const largeRatio = distribution.large / totalPoints
        
        console.log(`角度變化分佈 - 小角度: ${(smallRatio*100).toFixed(1)}%, 中角度: ${(mediumRatio*100).toFixed(1)}%, 大角度: ${(largeRatio*100).toFixed(1)}%`)
        
        let adjustedSmoothness = baseSmoothness
        
        // 如果大部分都是小角度變化，提高平滑度評分
        if (smallRatio > 0.7) {
            adjustedSmoothness = Math.min(1.0, baseSmoothness * 1.1)
            console.log(`大部分為小角度變化，平滑度提升`)
        }
        
        // 如果有很多大角度變化，這可能是折線而非圓滑曲線
        if (largeRatio > 0.3) {
            adjustedSmoothness = baseSmoothness * 0.8
            console.log(`檢測到較多大角度變化，平滑度降低`)
        }
        
        return adjustedSmoothness
    }

    calculateContextAwareSmoothness(points) {
        const basicSmoothness = this.calculateSmoothness(points)
        
        // 檢測軌跡類型
        const bounds = this.getBounds(points)
        const aspectRatio = bounds.width / bounds.height
        
        // 根據不同形狀調整平滑度期望
        let expectedSmoothness = 0.5  // 默認期望
        
        if (aspectRatio > 0.7 && aspectRatio < 1.3) {
            // 接近正方形，可能是圓形，期望較高平滑度
            expectedSmoothness = 0.8
            console.log(`檢測到接近正方形軌跡，期望高平滑度`)
        } else if (aspectRatio > 2.0 || aspectRatio < 0.5) {
            // 很扁或很高，可能是Z或I形，期望較低平滑度
            expectedSmoothness = 0.3
            console.log(`檢測到極端長寬比軌跡，期望低平滑度`)
        }
        
        // 計算相對平滑度評分
        const relativeSmoothness = basicSmoothness / expectedSmoothness
        return Math.min(1.0, relativeSmoothness)
    }

    calculateMultiScaleSmoothness(points) {
        const scales = [1, 2, 3, 4]  // 不同的採樣距離
        let weightedSmoothness = 0
        let totalWeight = 0
        
        for (let scale of scales) {
            if (points.length <= scale * 4) continue  // 確保有足夠點數
            
            const smoothness = this.calculateSmoothnessAtScale(points, scale)
            const weight = 1.0 / scale  // 較小尺度給更高權重
            
            weightedSmoothness += smoothness * weight
            totalWeight += weight
            
            console.log(`尺度${scale}平滑度: ${smoothness.toFixed(3)}, 權重: ${weight.toFixed(2)}`)
        }
        
        return totalWeight > 0 ? weightedSmoothness / totalWeight : 0
    }
    
    calculateSmoothnessAtScale(points, scale) {
        let totalCurvature = 0
        let validPoints = 0
        
        for (let i = scale; i < points.length - scale; i += scale) {
            const p1 = points[i - scale]
            const p2 = points[i]
            const p3 = points[i + scale]
            
            const angle1 = Math.atan2(p2.Y - p1.Y, p2.X - p1.X)
            const angle2 = Math.atan2(p3.Y - p2.Y, p3.X - p2.X)
            let angleDiff = Math.abs(angle1 - angle2)
            if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff
            
            totalCurvature += this.calculateAngleSmoothness(angleDiff)
            validPoints++
        }
        
        return validPoints > 0 ? totalCurvature / validPoints : 0
    }
}