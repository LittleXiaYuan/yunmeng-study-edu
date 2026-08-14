package edu_service

import (
	"errors"
	"net/http"
	"os"
	"path/filepath"
)

const maxUserImageBytes = 5 << 20

var allowedImageExt = map[string]string{
	"image/png":  ".png",
	"image/jpeg": ".jpg",
	"image/webp": ".webp",
}

// SaveUserImage validates and writes an avatar/background image to
// {dataDir}/uploads/{kind}s/{userID}{ext}, overwriting any previous upload for
// that user, and returns the URL path clients can fetch it from.
func SaveUserImage(dataDir string, userID string, kind string, data []byte) (string, error) {
	if len(data) == 0 {
		return "", errors.New("empty file")
	}
	if len(data) > maxUserImageBytes {
		return "", errors.New("file too large")
	}
	mimeType := http.DetectContentType(data)
	ext, ok := allowedImageExt[mimeType]
	if !ok {
		return "", errors.New("unsupported image type: " + mimeType)
	}

	subdir := kind + "s"
	dir := filepath.Join(dataDir, "uploads", subdir)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return "", err
	}
	for _, otherExt := range allowedImageExt {
		if otherExt == ext {
			continue
		}
		_ = os.Remove(filepath.Join(dir, userID+otherExt))
	}
	filename := userID + ext
	path := filepath.Join(dir, filename)
	if err := os.WriteFile(path, data, 0644); err != nil {
		return "", err
	}
	return "/uploads/" + subdir + "/" + filename, nil
}
