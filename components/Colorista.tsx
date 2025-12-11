import React, { useState, useRef } from "react";
import {
  fileToGenerativePart,
  editHairImage,
  generateColoristConsultancy,
} from "../services/geminiService";
import {
  saveToLibrary,
  compressImageForStorage,
} from "../services/libraryService";
import { jsPDF } from "jspdf";
import { addWatermark } from "../utils/imageUtils";

interface ColoristReport {
  visagismAnalysis: string;
  diagnosis: string;
  highlightingTechnique: string;
  formula: {
    primary: string;
    toner?: string;
    alternatives?: string;
  };
  techniqueStepByStep: string[];
  troubleshooting?: string[];
  postChemicalCare: string[];
}

const BRANDS = [
  "L'Oréal Professionnel",
  "Wella Professionals",
  "Schwarzkopf Professional",
  "Truss Hair",
  "Braé",
  "Keune",
  "Joico",
  "Redken",
];

export const Colorista: React.FC = () => {
  const [clientImage, setClientImage] = useState<string | null>(null);
  const [refImage, setRefImage] = useState<string | null>(null);
  const [editedImage, setEditedImage] = useState<string | null>(null);

  const [clientName, setClientName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [brand, setBrand] = useState(BRANDS[0]);

  const [report, setReport] = useState<ColoristReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [sharing, setSharing] = useState(false);

  // Camera State
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">(() => {
    const saved = localStorage.getItem("colorista_camera_mode");
    return saved === "user" || saved === "environment" ? saved : "user";
  });
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleClientUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        setClientImage(reader.result as string);
        setReport(null);
        setEditedImage(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRefUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        setRefImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleResetClient = () => {
    setClientImage(null);
    setReport(null);
    setEditedImage(null);
  };
  const handleResetRef = () => {
    setRefImage(null);
  };
  const handleCloseReport = () => {
    setReport(null);
  };

  const handleProcess = async () => {
    if (!clientImage || !clientName.trim()) {
      alert("Por favor, preencha o nome da cliente e a imagem.");
      return;
    }
    setLoading(true);
    setReport(null);
    setEditedImage(null);

    try {
      const clientBase64 = clientImage.split(",")[1];
      const clientMime = clientImage.split(":")[1].split(";")[0];
      const refBase64 = refImage ? refImage.split(",")[1] : undefined;
      const refMime = refImage
        ? refImage.split(":")[1].split(";")[0]
        : undefined;
      const finalPrompt = refImage
        ? `${prompt} (Baseado na imagem de referência)`
        : prompt;

      // Show results immediately
      const reportData = await generateColoristConsultancy(
        clientBase64,
        clientMime,
        finalPrompt,
        brand,
        refBase64,
        refMime
      );
      setReport(reportData);

      const editPrompt = `Change hair color to match this description: ${reportData.diagnosis} and ${finalPrompt}. Keep face unchanged. Photorealistic.`;
      const visualResult = await editHairImage(
        clientBase64,
        clientMime,
        editPrompt
      );
      const watermarkedResult = await addWatermark(visualResult);
      setEditedImage(watermarkedResult);

      // Save compressed version to library in the background
      try {
        const compressedThumbnail = await compressImageForStorage(
          clientImage,
          512
        );
        const compressedGenerated = await compressImageForStorage(
          watermarkedResult,
          1024
        );

        await saveToLibrary({
          type: "COLORISTA",
          clientName: clientName,
          thumbnail: compressedThumbnail,
          brand: brand,
          reportData: reportData,
          generatedImages: [compressedGenerated],
        });
      } catch (saveError) {
        console.error("Failed to compress and save to library:", saveError);
      }
    } catch (error) {
      console.error(error);
      alert("Erro ao processar consultoria.");
    } finally {
      setLoading(false);
    }
  };

  // Camera Logic
  const startCamera = async (mode: "user" | "environment") => {
    setFacingMode(mode);
    localStorage.setItem("colorista_camera_mode", mode);
    setIsCameraOpen(true);
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
    }
    setTimeout(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: mode },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      } catch (err) {
        console.error(err);
        setIsCameraOpen(false);
      }
    }, 100);
  };

  const handleSwitchCamera = () => {
    const newMode = facingMode === "user" ? "environment" : "user";
    startCamera(newMode);
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
    }
    setIsCameraOpen(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        if (facingMode === "user") {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        setClientImage(canvas.toDataURL("image/jpeg"));
        setReport(null);
        setEditedImage(null);
        stopCamera();
      }
    }
  };

  const generatePDFDoc = () => {
    if (!report || !clientName) return null;
    const doc = new jsPDF({ orientation: "p", unit: "px", format: "a4" });
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 40;
    const contentWidth = pageWidth - margin * 2;
    let cursorY = 60;

    // --- Header ---
    doc.setFontSize(24);
    doc.setTextColor("#8A2BE2"); // neon.violet
    doc.text("4us! Smart Studio AI", pageWidth / 2, cursorY, {
      align: "center",
    });
    cursorY += 20;

    doc.setFontSize(16);
    doc.setTextColor(100);
    doc.text(`Dossiê Colorista: ${clientName}`, pageWidth / 2, cursorY, {
      align: "center",
    });
    doc.setFontSize(12);
    doc.text(`Marca: ${brand}`, pageWidth / 2, cursorY + 15, {
      align: "center",
    });
    cursorY += 40;

    // Helper to add sections
    const addSection = (
      title: string,
      content: string | string[],
      isList = false
    ) => {
      if (cursorY > pageHeight - margin * 2) {
        doc.addPage();
        cursorY = margin;
      }
      doc.setFontSize(14);
      doc.setTextColor("#8A2BE2");
      doc.text(title, margin, cursorY);
      cursorY += 20;

      doc.setFontSize(10);
      doc.setTextColor(80);

      let text = "";
      if (Array.isArray(content)) {
        text = content.map((item) => `${isList ? "• " : ""}${item}`).join("\n");
      } else {
        text = String(content);
      }

      const lines = doc.splitTextToSize(text, contentWidth);
      if (cursorY + lines.length * 12 > pageHeight - margin) {
        doc.addPage();
        cursorY = margin;
      }
      doc.text(lines, margin, cursorY);
      cursorY += lines.length * 12 + 15;
    };

    // --- Images (Before & After) ---
    try {
      const imgSize = (contentWidth - 10) / 2;
      if (cursorY + imgSize + 30 > pageHeight - margin) {
        doc.addPage();
        cursorY = margin;
      }

      doc.setFontSize(12);
      doc.setTextColor(100);
      doc.text("Antes (Cliente)", margin, cursorY);
      doc.text("Depois (Simulação)", margin + imgSize + 10, cursorY);
      cursorY += 15;

      if (clientImage)
        doc.addImage(
          clientImage,
          "PNG",
          margin,
          cursorY,
          imgSize,
          imgSize,
          undefined,
          "FAST"
        );
      if (editedImage)
        doc.addImage(
          editedImage,
          "PNG",
          margin + imgSize + 10,
          cursorY,
          imgSize,
          imgSize,
          undefined,
          "FAST"
        );

      cursorY += imgSize + 30;
    } catch (e) {
      console.error("Error adding images to PDF", e);
    }

    // --- Report Content ---
    addSection("Análise de Visagismo", report.visagismAnalysis);
    addSection("Diagnóstico", report.diagnosis);

    // Formula Section
    let formulaText = `Principal: ${report.formula.primary}`;
    if (report.formula.toner)
      formulaText += `\n\nTonalizante: ${report.formula.toner}`;
    if (report.formula.alternatives)
      formulaText += `\n\nAlternativa: ${report.formula.alternatives}`;
    addSection("Fórmula Exata", formulaText);

    addSection("Técnica de Aplicação", report.highlightingTechnique);
    addSection("Passo a Passo", report.techniqueStepByStep, true);

    if (report.troubleshooting && report.troubleshooting.length > 0) {
      addSection("Solução de Problemas", report.troubleshooting, true);
    }

    addSection(
      "Cuidados Pós-Química (Home Care)",
      report.postChemicalCare,
      true
    );

    return doc;
  };

  const handleSavePDF = () => {
    const doc = generatePDFDoc();
    if (doc) doc.save(`4us_colorista_${clientName.replace(/\s+/g, "_")}.pdf`);
  };

  const handleSharePDF = async () => {
    const doc = generatePDFDoc();
    if (!doc) return;
    setSharing(true);
    try {
      const blob = doc.output("blob");
      const file = new File(
        [blob],
        `4us_colorista_${clientName.replace(/\s+/g, "_")}.pdf`,
        { type: "application/pdf" }
      );
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Dossiê Colorista: ${clientName}`,
          text: `Confira o dossiê técnico de cor para ${clientName} gerado pelo 4us! Smart Studio AI.`,
        });
      } else {
        doc.save(`4us_colorista_${clientName.replace(/\s+/g, "_")}.pdf`);
      }
    } catch (e) {
      console.error(e);
      doc.save(`4us_colorista_${clientName.replace(/\s+/g, "_")}.pdf`);
    } finally {
      setSharing(false);
    }
  };

  const handleImageCompositeAction = async (action: "save" | "share") => {
    if (!clientImage || !editedImage) return;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const imgBefore = new Image();
    const imgAfter = new Image();

    imgBefore.src = clientImage;
    imgAfter.src = editedImage;

    await Promise.all([
      new Promise((resolve) => (imgBefore.onload = resolve)),
      new Promise((resolve) => (imgAfter.onload = resolve)),
    ]);

    const PADDING = 40;
    const TITLE_HEIGHT = 60;
    const FOOTER_HEIGHT = 50;

    // Calculate dynamic height based on aspect ratio to fit width
    const targetWidth = 600; // Fixed width for each image column on canvas
    const scaleBefore = targetWidth / imgBefore.width;
    const heightBefore = imgBefore.height * scaleBefore;

    const scaleAfter = targetWidth / imgAfter.width;
    const heightAfter = imgAfter.height * scaleAfter;

    const maxHeight = Math.max(heightBefore, heightAfter);

    canvas.width = targetWidth * 2 + PADDING * 3;
    canvas.height = maxHeight + PADDING * 2 + TITLE_HEIGHT + FOOTER_HEIGHT;

    // Background
    ctx.fillStyle = "#12121a"; // studio.card
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Title
    ctx.fillStyle = "#FFF";
    ctx.font = "bold 32px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
      `Antes & Depois - ${clientName}`,
      canvas.width / 2,
      PADDING + 30
    );

    // Images with labels
    const drawImageWithLabel = (
      img: HTMLImageElement,
      x: number,
      y: number,
      w: number,
      h: number,
      label: string
    ) => {
      // Center image vertically in the allotted space if one is shorter
      const yOffset = (maxHeight - h) / 2;
      ctx.drawImage(img, x, y + yOffset, w, h);

      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(x, y + yOffset + h - 40, w, 40);
      ctx.fillStyle = "#FFF";
      ctx.font = "24px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(label, x + w / 2, y + yOffset + h - 10);
    };

    drawImageWithLabel(
      imgBefore,
      PADDING,
      PADDING + TITLE_HEIGHT,
      targetWidth,
      heightBefore,
      "Antes"
    );
    drawImageWithLabel(
      imgAfter,
      PADDING * 2 + targetWidth,
      PADDING + TITLE_HEIGHT,
      targetWidth,
      heightAfter,
      "Depois"
    );

    // Footer
    ctx.fillStyle = "#8A2BE2"; // neon.violet
    ctx.font = "bold 28px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("4us! Smart Studio AI", canvas.width / 2, canvas.height - 20);

    const dataUrl = canvas.toDataURL("image/png");

    if (action === "save") {
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `4us_comparacao_${clientName}.png`;
      link.click();
    } else {
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `4us_comparacao_${clientName}.png`, {
        type: "image/png",
      });
      if (navigator.share && navigator.canShare({ files: [file] })) {
        navigator.share({
          files: [file],
          title: `Comparação para ${clientName}`,
        });
      } else {
        alert("Compartilhamento não suportado. O download será iniciado.");
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = `4us_comparacao_${clientName}.png`;
        link.click();
      }
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-10">
      <div className="absolute top-8 right-8 z-20">
        <button
          onClick={() => handleCloseReport()}
          className="text-gray-500 hover:text-white transition-colors"
        >
          <svg
            className="w-8 h-8"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <div className="text-center mb-8">
        <h2 className="text-4xl font-bold text-white mb-2">Colorista Expert</h2>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          {/* Input Client Name */}
          <div className="bg-studio-card p-5 rounded-2xl border border-studio-accent">
            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">
              Nome da Cliente
            </label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="w-full bg-studio-bg border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-neon-purple outline-none"
              placeholder="Nome Completo"
            />
          </div>

          {/* Client Photo */}
          <div className="bg-studio-card p-5 rounded-2xl border border-studio-accent">
            <h3 className="text-white font-bold mb-3">1. Foto da Cliente</h3>
            <div className="relative group aspect-[3/4] border-2 border-dashed border-gray-700 hover:border-neon-violet transition-colors rounded-xl overflow-hidden">
              {!clientImage ? (
                <div className="h-full flex flex-col items-center justify-center cursor-pointer bg-black/30">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleClientUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <span className="text-gray-400">Carregar Foto</span>
                </div>
              ) : (
                <div className="h-full w-full relative bg-black">
                  <img
                    src={clientImage}
                    alt="Client"
                    className="h-full w-full object-contain"
                  />
                </div>
              )}
            </div>
            {!clientImage && (
              <div className="grid grid-cols-2 gap-4 mt-4">
                <button
                  onClick={() => startCamera("user")}
                  className="py-3 rounded-xl font-bold text-white bg-gradient-to-r from-purple-600 to-blue-600 shadow-lg text-sm"
                >
                  Selfie
                </button>
                <button
                  onClick={() => startCamera("environment")}
                  className="py-3 rounded-xl font-bold text-gray-300 bg-studio-card border border-gray-600 text-sm"
                >
                  Câmera Traseira
                </button>
              </div>
            )}
            {clientImage && (
              <button
                onClick={handleResetClient}
                className="w-full text-center text-xs text-gray-500 hover:text-red-400 mt-2"
              >
                Nova Foto
              </button>
            )}
          </div>

          {/* Reference & Config (Same as before) */}
          <div className="bg-studio-card p-5 rounded-2xl border border-studio-accent">
            <h3 className="text-white font-bold mb-3">
              2. Referência (Opcional)
            </h3>
            <div className="relative group aspect-[4/3] border-2 border-dashed border-gray-700 rounded-xl overflow-hidden flex justify-center items-center">
              {!refImage ? (
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleRefUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
              ) : (
                <img src={refImage} className="h-full w-full object-contain" />
              )}
              {!refImage && <span className="text-gray-500">Enviar Ref</span>}
            </div>
            {refImage && (
              <button
                onClick={handleResetRef}
                className="w-full text-center text-xs text-gray-500 hover:text-red-400 mt-2"
              >
                Nova Referência
              </button>
            )}
          </div>

          <div className="bg-studio-card p-5 rounded-2xl border border-studio-accent space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">
                Marca
              </label>
              <select
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="w-full bg-studio-bg border border-gray-700 rounded-lg px-3 py-2 text-white"
              >
                {BRANDS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">
                Desejo
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full h-24 bg-studio-bg border border-gray-700 rounded-lg px-3 py-2 text-white resize-none"
                placeholder="Ex: Loiro perolado..."
              />
            </div>
            <button
              onClick={handleProcess}
              disabled={!clientImage || !clientName || loading}
              className="w-full py-3 rounded-lg font-bold bg-gradient-to-r from-neon-purple to-neon-violet text-white disabled:opacity-50"
            >
              {loading ? "Analisando..." : "Gerar Dossiê"}
            </button>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="bg-studio-card p-1 rounded-2xl border border-studio-accent shadow-lg h-[600px] flex items-center justify-center relative group bg-black/50 overflow-hidden">
            {editedImage ? (
              <>
                <div className="flex w-full h-full">
                  {/* Responsive container for before/after */}
                  <div className="w-1/2 relative bg-black flex items-center justify-center overflow-hidden">
                    <img
                      src={clientImage!}
                      className="w-full h-full object-contain opacity-80"
                      alt="Antes"
                    />
                    <span className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                      Antes
                    </span>
                  </div>
                  <div className="w-1/2 relative bg-black flex items-center justify-center overflow-hidden">
                    <img
                      src={editedImage}
                      className="w-full h-full object-contain"
                      alt="Depois"
                    />
                    <span className="absolute bottom-2 right-2 bg-purple-600 text-white text-xs px-2 py-1 rounded">
                      Depois
                    </span>
                  </div>
                </div>
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <button
                    onClick={() => handleImageCompositeAction("save")}
                    className="bg-black/60 backdrop-blur-sm text-white px-4 py-2 rounded-full flex items-center gap-2 border border-white/20 hover:bg-black/80"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                      />
                    </svg>
                    Salvar Imagem
                  </button>
                  <button
                    onClick={() => handleImageCompositeAction("share")}
                    className="bg-black/60 backdrop-blur-sm text-white px-4 py-2 rounded-full flex items-center gap-2 border border-white/20 hover:bg-black/80"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
                    </svg>
                    Compartilhar
                  </button>
                </div>
              </>
            ) : (
              <p className="text-gray-600">A simulação visual aparecerá aqui</p>
            )}
            {loading && (
              <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-20">
                <div className="animate-spin w-12 h-12 border-4 border-neon-violet border-t-transparent rounded-full"></div>
              </div>
            )}
          </div>

          {report && (
            <div className="bg-studio-card rounded-2xl border border-studio-accent p-6 space-y-4 animate-in fade-in duration-500">
              <div className="flex justify-between items-center border-b border-gray-700 pb-4 flex-wrap gap-4">
                <h3 className="text-xl font-bold text-neon-cyan">
                  Relatório Técnico: {clientName}
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={handleSavePDF}
                    className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors border border-gray-600"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2-2z"
                      />
                    </svg>
                    Salvar PDF
                  </button>
                  <button
                    onClick={handleSharePDF}
                    disabled={sharing}
                    className="bg-neon-violet hover:bg-violet-700 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
                    </svg>
                    {sharing ? "..." : "Compartilhar PDF"}
                  </button>
                  <button
                    onClick={handleCloseReport}
                    title="Fechar"
                    className="text-gray-500 hover:text-red-500 ml-2"
                  >
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                  <h4 className="font-bold text-purple-400 mb-2">
                    Análise de Visagismo
                  </h4>
                  <p className="text-gray-300 text-sm leading-relaxed">
                    {report.visagismAnalysis}
                  </p>
                </div>

                <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                  <h4 className="font-bold text-purple-400 mb-2">
                    Diagnóstico
                  </h4>
                  <p className="text-gray-300 text-sm leading-relaxed">
                    {report.diagnosis}
                  </p>
                </div>

                <div className="bg-neon-cyan/10 p-4 rounded-lg border border-neon-cyan/30">
                  <h4 className="font-bold text-neon-cyan mb-2">
                    Fórmula ({brand})
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-cyan-200 uppercase font-bold">
                        Principal:
                      </p>
                      <p className="font-mono text-sm text-white">
                        {report.formula.primary}
                      </p>
                    </div>
                    {report.formula.toner && (
                      <div>
                        <p className="text-xs text-cyan-200 uppercase font-bold">
                          Tonalizante:
                        </p>
                        <p className="font-mono text-sm text-white">
                          {report.formula.toner}
                        </p>
                      </div>
                    )}
                    {report.formula.alternatives && (
                      <div>
                        <p className="text-xs text-cyan-200 uppercase font-bold">
                          Alternativa:
                        </p>
                        <p className="font-mono text-sm text-white">
                          {report.formula.alternatives}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                  <h4 className="font-bold text-purple-400 mb-2">
                    Técnica de Mechas/Aplicação
                  </h4>
                  <p className="text-gray-300 text-sm leading-relaxed">
                    {report.highlightingTechnique}
                  </p>
                </div>

                <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                  <h4 className="font-bold text-purple-400 mb-2">
                    Passo a Passo
                  </h4>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-gray-300">
                    {report.techniqueStepByStep.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                </div>

                {report.troubleshooting && (
                  <div className="bg-yellow-900/20 p-4 rounded-lg border border-yellow-500/30">
                    <h4 className="font-bold text-yellow-400 mb-2">
                      Solução de Problemas Comuns
                    </h4>
                    <ul className="list-disc list-inside space-y-2 text-sm text-yellow-200/80">
                      {report.troubleshooting.map((tip, i) => (
                        <li key={i}>{tip}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                  <h4 className="font-bold text-purple-400 mb-2">
                    Cuidados Pós-Química (Home Care)
                  </h4>
                  <ul className="list-disc list-inside space-y-2 text-sm text-gray-300">
                    {report.postChemicalCare.map((tip, i) => (
                      <li key={i}>{tip}</li>
                    ))}
                  </ul>
                </div>

                {/* Footer Action Buttons */}
                <div className="grid grid-cols-2 gap-3 pt-4 border-t border-gray-700">
                  <button
                    onClick={handleSavePDF}
                    className="bg-studio-bg hover:bg-gray-800 text-gray-300 py-3 rounded-xl text-sm border border-gray-700 flex items-center justify-center gap-2"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2-2z"
                      />
                    </svg>
                    Salvar PDF Completo
                  </button>
                  <button
                    onClick={handleSharePDF}
                    disabled={sharing}
                    className="bg-gradient-to-r from-neon-purple to-neon-violet text-white font-bold py-3 rounded-xl hover:opacity-90 text-sm flex items-center justify-center gap-2"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
                    </svg>
                    {sharing ? "Gerando..." : "Compartilhar PDF"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      {isCameraOpen && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4">
          <video
            ref={videoRef}
            className="max-w-full max-h-[80vh] rounded-lg"
            autoPlay
            playsInline
            muted
          ></video>
          <canvas ref={canvasRef} className="hidden"></canvas>
          <div className="absolute top-4 left-4">
            <button
              onClick={handleSwitchCamera}
              className="p-3 bg-white/10 rounded-full text-white"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
          </div>
          <div className="flex gap-4 mt-4">
            <button
              onClick={capturePhoto}
              className="w-20 h-20 bg-white rounded-full border-4 border-black/50 ring-4 ring-white/50 hover:ring-neon-violet"
            ></button>
            <button
              onClick={stopCamera}
              className="absolute bottom-10 right-10 px-4 py-2 bg-gray-800/50 text-white rounded-full text-sm"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
