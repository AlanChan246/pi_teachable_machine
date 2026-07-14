# Pi Teachable Machine

10Botics 剪刀石頭布 AI 影像辨識課程 Jupyter Notebook。

## Branch 說明

本 repo 依 Raspberry Pi 型號提供兩個 branch：

| Branch | 適用硬體 | 相機方式 | 說明 |
|--------|----------|----------|------|
| `main` | **Raspberry Pi 5** | Picamera2 (libcamera) | 預設 branch，使用 Pi 5 原生相機 API |
| `pi4-opencv` | **Raspberry Pi 4** | OpenCV (`cv2.VideoCapture`) | 適用 libcamera 未啟用、但 V4L2 可正常取像的 Pi 4 |

### 如何切換 branch

```bash
# Pi 5（預設）
git checkout main

# Pi 4
git checkout pi4-opencv
```

## 相機相關 Notebook

以下 notebook 在兩個 branch 的相機實作不同，其餘 notebook 內容相同：

1. `1. 確認裝備.ipynb`
2. `2. 用 Pi 鏡頭訓練你的 AI 裁判.ipynb`
3. `3. AI 影像辨識主程式.ipynb`
4. `5. AI 剪刀石頭布.ipynb`

## Pi 4 注意事項

- 相機透過 `/dev/video0`（OpenCV）存取，**不需要**安裝 `python3-picamera2`
- 若畫面方向不對，可在 notebook 中修改 `FLIP_MODE`（`0`、`1` 或 `-1`）
- 若有多個相機裝置，可修改 `CAMERA_INDEX`

## Pi 5 注意事項

- 需啟用 libcamera（`raspi-config` → Interface Options → Camera → Yes）
- 需安裝 `python3-picamera2`

---

Created by [10Botics](https://www.10botics.com). For permission to use in school, contact info@10botics.com
