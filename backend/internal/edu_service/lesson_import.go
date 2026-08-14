package edu_service

import (
	"archive/zip"
	"bytes"
	"encoding/xml"
	"errors"
	"html"
	"io"
	"path/filepath"
	"strings"
	"unicode"

	"github.com/ledongthuc/pdf"
)

const maxImportedFileBytes = 50 << 20

type ImportedLessonFile struct {
	FileName string
	Title    string
	Content  string
}

type LessonImportResult struct {
	Files   []ImportedLessonFile
	Skipped []LessonImportSkip
}

func ImportLessonFiles(fileName string, data []byte, fallbackContent string) ([]ImportedLessonFile, error) {
	result, err := ImportLessonBundle(fileName, data, fallbackContent)
	return result.Files, err
}

func ImportLessonBundle(fileName string, data []byte, fallbackContent string) (LessonImportResult, error) {
	ext := strings.ToLower(filepath.Ext(fileName))
	switch ext {
	case ".zip":
		return importLessonZip(data, fallbackContent)
	case ".docx":
		content, err := extractDocxText(data)
		if err != nil {
			return LessonImportResult{Skipped: []LessonImportSkip{{FileName: fileName, Reason: err.Error()}}}, err
		}
		return singleImport(fileName, content), nil
	case ".pptx":
		content, err := extractOpenXMLText(data, []string{"ppt/slides/", "ppt/notesSlides/"})
		if err != nil {
			return LessonImportResult{Skipped: []LessonImportSkip{{FileName: fileName, Reason: err.Error()}}}, err
		}
		return singleImport(fileName, content), nil
	case ".xlsx":
		content, err := extractOpenXMLText(data, []string{"xl/sharedStrings.xml", "xl/worksheets/", "xl/charts/"})
		if err != nil {
			return LessonImportResult{Skipped: []LessonImportSkip{{FileName: fileName, Reason: err.Error()}}}, err
		}
		return singleImport(fileName, content), nil
	case ".pdf":
		content, err := extractPDFText(data)
		if err != nil {
			return LessonImportResult{Skipped: []LessonImportSkip{{FileName: fileName, Reason: err.Error()}}}, err
		}
		return singleImport(fileName, content), nil
	case ".txt", ".md", ".csv", ".json", ".sql":
		content := strings.TrimSpace(string(data))
		if content == "" {
			content = strings.TrimSpace(fallbackContent)
		}
		if content == "" {
			err := errors.New("文件内容为空")
			return LessonImportResult{Skipped: []LessonImportSkip{{FileName: fileName, Reason: err.Error()}}}, err
		}
		return singleImport(fileName, content), nil
	default:
		content := strings.TrimSpace(string(data))
		if content == "" {
			content = strings.TrimSpace(fallbackContent)
		}
		if content == "" {
			err := errors.New("不支持的资料格式或文件为空")
			return LessonImportResult{Skipped: []LessonImportSkip{{FileName: fileName, Reason: err.Error()}}}, err
		}
		return singleImport(fileName, content), nil
	}
}

func singleImport(fileName string, content string) LessonImportResult {
	return LessonImportResult{Files: []ImportedLessonFile{{FileName: fileName, Title: lessonTitleFromFile(fileName), Content: content}}}
}

func importLessonZip(data []byte, fallbackContent string) (LessonImportResult, error) {
	reader, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return LessonImportResult{}, err
	}
	imported := []ImportedLessonFile{}
	skipped := []LessonImportSkip{}
	for _, entry := range reader.File {
		if entry.FileInfo().IsDir() || entry.UncompressedSize64 == 0 {
			continue
		}
		if entry.UncompressedSize64 > maxImportedFileBytes {
			skipped = append(skipped, LessonImportSkip{FileName: entry.Name, Reason: "文件超过 50MB，已跳过"})
			continue
		}
		name := strings.ReplaceAll(entry.Name, "\\", "/")
		base := filepath.Base(name)
		if strings.HasPrefix(base, "~$") || strings.HasPrefix(base, ".") {
			continue
		}
		ext := strings.ToLower(filepath.Ext(base))
		if !isSupportedLessonImport(ext) {
			skipped = append(skipped, LessonImportSkip{FileName: entry.Name, Reason: "暂不支持该格式"})
			continue
		}
		file, err := entry.Open()
		if err != nil {
			skipped = append(skipped, LessonImportSkip{FileName: entry.Name, Reason: err.Error()})
			continue
		}
		content, err := io.ReadAll(io.LimitReader(file, maxImportedFileBytes))
		_ = file.Close()
		if err != nil {
			skipped = append(skipped, LessonImportSkip{FileName: entry.Name, Reason: err.Error()})
			continue
		}
		result, err := ImportLessonBundle(base, content, fallbackContent)
		if err != nil {
			if len(result.Skipped) > 0 {
				skipped = append(skipped, result.Skipped...)
			} else {
				skipped = append(skipped, LessonImportSkip{FileName: entry.Name, Reason: err.Error()})
			}
			continue
		}
		imported = append(imported, result.Files...)
		skipped = append(skipped, result.Skipped...)
	}
	if len(imported) == 0 {
		return LessonImportResult{Skipped: skipped}, errors.New("zip 中没有可解析的课程资料文件")
	}
	return LessonImportResult{Files: imported, Skipped: skipped}, nil
}

func isSupportedLessonImport(ext string) bool {
	switch strings.ToLower(ext) {
	case ".docx", ".pptx", ".xlsx", ".pdf", ".txt", ".md", ".csv", ".json", ".sql":
		return true
	default:
		return false
	}
}

func extractDocxText(data []byte) (string, error) {
	reader, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return "", err
	}
	parts := []string{}
	for _, entry := range reader.File {
		if entry.Name != "word/document.xml" && !strings.HasPrefix(entry.Name, "word/header") && !strings.HasPrefix(entry.Name, "word/footer") {
			continue
		}
		file, err := entry.Open()
		if err != nil {
			return "", err
		}
		raw, err := io.ReadAll(io.LimitReader(file, maxImportedFileBytes))
		_ = file.Close()
		if err != nil {
			return "", err
		}
		parts = append(parts, textFromWordXML(raw))
	}
	content := normalizeImportedText(strings.Join(parts, "\n"))
	if content == "" {
		return "", errors.New("docx 中没有提取到正文")
	}
	return content, nil
}

func extractOpenXMLText(data []byte, prefixes []string) (string, error) {
	reader, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return "", err
	}
	parts := []string{}
	for _, entry := range reader.File {
		if !matchesOpenXMLPart(entry.Name, prefixes) {
			continue
		}
		file, err := entry.Open()
		if err != nil {
			return "", err
		}
		raw, err := io.ReadAll(io.LimitReader(file, maxImportedFileBytes))
		_ = file.Close()
		if err != nil {
			return "", err
		}
		text := textFromWordXML(raw)
		if text != "" {
			parts = append(parts, text)
		}
	}
	content := normalizeImportedText(strings.Join(parts, "\n"))
	if content == "" {
		return "", errors.New("文件中没有提取到可用正文")
	}
	return content, nil
}

func matchesOpenXMLPart(name string, prefixes []string) bool {
	for _, prefix := range prefixes {
		if strings.HasSuffix(prefix, ".xml") && name == prefix {
			return true
		}
		if strings.HasSuffix(name, ".xml") && strings.HasPrefix(name, prefix) {
			return true
		}
	}
	return false
}

func extractPDFText(data []byte) (text string, err error) {
	defer func() {
		if recovered := recover(); recovered != nil {
			err = errors.New("PDF 解析失败，可能是加密文件或结构异常")
		}
	}()
	reader, err := pdf.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return "", err
	}
	plain, err := reader.GetPlainText()
	if err != nil {
		return "", err
	}
	raw, err := io.ReadAll(io.LimitReader(plain, maxImportedFileBytes))
	if err != nil {
		return "", err
	}
	content := normalizeImportedText(string(raw))
	if content == "" {
		return "", errors.New("PDF 中没有提取到正文，可能是扫描版文件")
	}
	return content, nil
}

func textFromWordXML(raw []byte) string {
	decoder := xml.NewDecoder(bytes.NewReader(raw))
	out := strings.Builder{}
	lastWasBreak := false
	for {
		token, err := decoder.Token()
		if err == io.EOF {
			break
		}
		if err != nil {
			return normalizeImportedText(out.String())
		}
		switch item := token.(type) {
		case xml.StartElement:
			name := item.Name.Local
			if name == "p" || name == "tr" {
				if !lastWasBreak {
					out.WriteString("\n")
					lastWasBreak = true
				}
			}
			if name == "tab" {
				out.WriteString(" ")
			}
		case xml.CharData:
			text := strings.TrimSpace(html.UnescapeString(string(item)))
			if text == "" {
				continue
			}
			if !lastWasBreak {
				out.WriteString(" ")
			}
			out.WriteString(text)
			lastWasBreak = false
		}
	}
	return normalizeImportedText(out.String())
}

func normalizeImportedText(value string) string {
	value = strings.ReplaceAll(value, "\r\n", "\n")
	value = strings.ReplaceAll(value, "\r", "\n")
	lines := strings.Split(value, "\n")
	out := []string{}
	for _, line := range lines {
		line = strings.TrimSpace(strings.Map(func(r rune) rune {
			if unicode.IsControl(r) && r != '\n' && r != '\t' {
				return -1
			}
			return r
		}, line))
		if line != "" {
			out = append(out, line)
		}
	}
	return strings.Join(out, "\n")
}

func lessonTitleFromFile(fileName string) string {
	base := filepath.Base(strings.ReplaceAll(fileName, "\\", "/"))
	title := strings.TrimSuffix(base, filepath.Ext(base))
	title = strings.TrimSpace(title)
	if title == "" {
		return "课程资料"
	}
	return title
}
