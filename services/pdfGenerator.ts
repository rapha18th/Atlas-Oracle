import { jsPDF } from "jspdf";
import { AnalysisResult, Coordinates } from "../types";

export const generatePDF = (result: AnalysisResult, coords: Coordinates, radiusKm: number) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let yPos = 20;

  // Helper for text wrapping
  const printText = (text: string, fontSize: number, isBold: boolean = false, color: string = "#1f2937") => {
    doc.setFontSize(fontSize);
    doc.setTextColor(color);
    doc.setFont("helvetica", isBold ? "bold" : "normal");
    
    const splitText = doc.splitTextToSize(text, pageWidth - (margin * 2));
    
    // Check page break
    if (yPos + (splitText.length * fontSize * 0.5) > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      yPos = 20;
    }
    
    doc.text(splitText, margin, yPos);
    yPos += (splitText.length * fontSize * 0.45) + 4; // Line height + spacing
  };

  const drawLine = () => {
    doc.setDrawColor(226, 232, 240); // Slate-200
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 10;
  };

  // --- HEADER ---
  printText("ATLAS ORACLE | Location Feasibility Report", 16, true, "#0f766e"); // Teal-700
  yPos += 2;
  printText(`Generated: ${new Date().toLocaleDateString()}`, 10, false, "#64748b");
  yPos += 6;
  
  doc.setFillColor(241, 245, 249); // Slate-100
  doc.roundedRect(margin, yPos, pageWidth - (margin * 2), 25, 2, 2, 'F');
  yPos += 6;
  doc.setFontSize(10);
  doc.setTextColor("#334155");
  doc.text(`Coordinates: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`, margin + 4, yPos);
  doc.text(`Analysis Radius: ${radiusKm} km`, margin + 4, yPos + 6);
  doc.text(`Location Context: ${result.evidence.reverse_geocode_label}`, margin + 4, yPos + 12);
  yPos += 28;

  // --- AREA SUMMARY ---
  printText("EXECUTIVE SUMMARY", 12, true, "#0f766e");
  printText(result.area_summary, 10, false, "#334155");
  yPos += 4;
  drawLine();

  // --- OPPORTUNITIES ---
  printText("STRATEGIC OPPORTUNITIES", 12, true, "#0f766e");
  
  result.top_opportunities.forEach((opp) => {
    // Check page break for block start
    if (yPos > doc.internal.pageSize.getHeight() - 60) {
      doc.addPage();
      yPos = 20;
    }

    // Opportunity Title
    doc.setFillColor(240, 253, 250); // Teal-50
    doc.rect(margin, yPos, pageWidth - (margin * 2), 10, 'F');
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor("#0f766e");
    doc.text(opp.name, margin + 2, yPos + 7);
    
    // Confidence Tag
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor("#059669");
    const confText = `${opp.confidence_0_100}% Confidence`;
    const confWidth = doc.getTextWidth(confText);
    doc.text(confText, pageWidth - margin - confWidth - 2, yPos + 7);
    
    yPos += 16;

    // Rationale
    printText(`Rationale: ${opp.rationale}`, 10, false, "#475569");
    yPos += 2;

    // Example Project Block
    doc.setDrawColor(203, 213, 225); // Slate-300
    doc.setLineWidth(0.5);
    doc.line(margin + 2, yPos, margin + 2, yPos + 25); // Vertical accent line
    
    const originalMargin = margin;
    const indentedMargin = margin + 6;
    
    // Temporarily indent
    const printIndented = (txt: string, size: number, bold: boolean, col: string) => {
        doc.setFontSize(size);
        doc.setTextColor(col);
        doc.setFont("helvetica", bold ? "bold" : "normal");
        const split = doc.splitTextToSize(txt, pageWidth - (indentedMargin + margin));
        doc.text(split, indentedMargin, yPos + 4); // +4 acts as line height offset
        yPos += (split.length * size * 0.45) + 4;
    };

    printIndented(`Concept: ${opp.example_project}`, 10, true, "#1e293b");
    printIndented(opp.project_description, 9, false, "#475569");
    
    printIndented(`Est. Startup Cost: ${opp.estimated_cost?.total || "N/A"}`, 9, true, "#1e293b");
    
    if (opp.estimated_cost?.breakdown) {
       opp.estimated_cost.breakdown.forEach(item => {
           printIndented(`• ${item}`, 9, false, "#64748b");
       });
    }

    yPos += 6;
  });

  drawLine();

  // --- LAND USE & RISKS ---
  // Simple 2-column layout equivalent
  const colWidth = (pageWidth - (margin * 2)) / 2;
  const startY = yPos;
  
  // Column 1: Land Use
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor("#0f766e");
  doc.text("Suggested Land Use", margin, yPos);
  yPos += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor("#334155");
  result.land_use_suggestions.forEach(item => {
      const split = doc.splitTextToSize(`• ${item}`, colWidth - 5);
      doc.text(split, margin, yPos);
      yPos += (split.length * 4) + 2;
  });

  // Reset Y for Col 2 and track max
  let maxY = yPos;
  yPos = startY;

  // Column 2: Risks
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor("#b45309"); // Amber-700
  doc.text("Risks & Constraints", margin + colWidth, yPos);
  yPos += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor("#334155");
  result.risks.forEach(item => {
      const split = doc.splitTextToSize(`• ${item}`, colWidth - 5);
      doc.text(split, margin + colWidth, yPos);
      yPos += (split.length * 4) + 2;
  });

  yPos = Math.max(yPos, maxY) + 10;
  drawLine();

  // --- RECOMMENDATIONS ---
  printText("STRATEGIC RECOMMENDATIONS", 12, true, "#0f766e");
  result.recommendations.forEach(rec => {
      printText(`• ${rec}`, 10, false, "#334155");
  });

  // --- DISCLAIMER ---
  yPos = doc.internal.pageSize.getHeight() - 25;
  doc.setDrawColor(203, 213, 225);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 5;
  doc.setFontSize(7);
  doc.setTextColor("#94a3b8");
  doc.text("DISCLAIMER: This report is generated by an AI system (Atlas Oracle) for exploratory purposes only. It does not constitute financial, legal, or real estate advice. All cost estimates are rough approximations and should be verified by professional consultants.", margin, yPos, { maxWidth: pageWidth - (margin * 2) });

  // Save
  doc.save(`AtlasOracle_Analysis_${coords.lat.toFixed(4)}_${coords.lng.toFixed(4)}.pdf`);
};
