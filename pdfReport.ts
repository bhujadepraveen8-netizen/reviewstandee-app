import { jsPDF } from 'jspdf';
import { Business, DashboardStats, Complaint, Feedback } from '../types';

export function generateMonthlyPDFReport(
  business: Business,
  stats: DashboardStats,
  complaints: Complaint[],
  feedbackList: Feedback[],
  monthName: string = 'Current Month'
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  // Header Banner
  doc.setFillColor(30, 41, 59); // Slate 800
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text('HeReview — Monthly Performance Report', 14, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(203, 213, 225);
  doc.text(`Official Analytics & Negative Review Interception Report · ${monthName}`, 14, 20);

  y = 38;

  // Business Metadata Block
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text(business.name, 14, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  y += 5;
  if (business.address) {
    doc.text(`Location: ${business.address}`, 14, y);
    y += 4;
  }
  doc.text(`Standee Slug: hereview.com/r/${business.slug}   |   Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}`, 14, y);

  y += 10;

  // Divider line
  doc.setDrawColor(226, 232, 240);
  doc.line(14, y, pageWidth - 14, y);
  y += 10;

  // Section: Executive Summary (4 KPI metric boxes)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text('EXECUTIVE PERFORMANCE SUMMARY', 14, y);
  y += 6;

  const colWidth = (pageWidth - 28 - 9) / 4;
  const kpis = [
    { label: 'Total QR Scans', val: stats.totalScans.toLocaleString() },
    { label: 'Total Reviews', val: stats.totalRatings.toLocaleString() },
    { label: 'Average Rating', val: `${stats.averageRating.toFixed(1)} / 5.0` },
    { label: 'Intercepted (1-3★)', val: `${stats.negativeFeedbackCount} (${stats.interceptRate.toFixed(0)}%)` },
  ];

  kpis.forEach((kpi, idx) => {
    const x = 14 + idx * (colWidth + 3);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, y, colWidth, 22, 2, 2, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.label, x + 4, y + 7);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text(kpi.val, x + 4, y + 16);
  });

  y += 32;

  // Rating Distribution breakdown
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text('CUSTOMER SENTIMENT BREAKDOWN', 14, y);
  y += 6;

  const totalReviews = stats.totalRatings || 1;
  const stars = [5, 4, 3, 2, 1];

  stars.forEach((star) => {
    const count = stats.ratingsBreakdown[star] || 0;
    const pct = ((count / totalReviews) * 100).toFixed(1);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    doc.text(`${star} Stars:`, 14, y);

    // Progress bar track
    doc.setFillColor(241, 245, 249);
    doc.rect(32, y - 3, 100, 4, 'F');

    // Progress bar fill
    if (count > 0) {
      if (star >= 4) {
        doc.setFillColor(22, 163, 74); // Green
      } else {
        doc.setFillColor(220, 38, 38); // Crimson for intercepted
      }
      const fillW = Math.max(2, (Number(pct) / 100) * 100);
      doc.rect(32, y - 3, fillW, 4, 'F');
    }

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`${count} (${pct}%)`, 136, y);

    if (star >= 4) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(22, 163, 74);
      doc.text('→ Routed to Google Reviews', 165, y);
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(220, 38, 38);
      doc.text('→ Protected (Internal Only)', 165, y);
    }

    y += 7;
  });

  y += 8;

  // Intercepted Private Issues Summary Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text('INTERCEPTED PRIVATE ISSUES (PREVENTED FROM GOOGLE)', 14, y);
  y += 6;

  // Table header
  doc.setFillColor(241, 245, 249);
  doc.rect(14, y, pageWidth - 28, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('Date', 16, y + 5);
  doc.text('Category', 38, y + 5);
  doc.text('Message / Customer Feedback', 70, y + 5);
  doc.text('Table', 150, y + 5);
  doc.text('Status', 168, y + 5);
  y += 8;

  const complaintsToShow = complaints.slice(0, 5);
  if (complaintsToShow.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(148, 163, 184);
    doc.text('No private complaints recorded for this period. Great customer satisfaction!', 16, y + 4);
    y += 10;
  } else {
    complaintsToShow.forEach((c) => {
      const d = new Date(c.created_at).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);
      doc.text(d, 16, y + 4);
      doc.text(c.category, 38, y + 4);

      const msg = c.message.length > 55 ? c.message.substring(0, 52) + '...' : c.message;
      doc.text(msg, 70, y + 4);
      doc.text(c.table_number ? `#${c.table_number}` : '—', 150, y + 4);
      doc.text(c.status.toUpperCase(), 168, y + 4);

      doc.setDrawColor(241, 245, 249);
      doc.line(14, y + 6, pageWidth - 14, y + 6);
      y += 8;
    });
  }

  y += 6;

  // Actionable Staff Recommendations
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text('MANAGER RECOMMENDATIONS FOR NEXT MONTH', 14, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  const tips = [
    `1. Standee Placement: Ensure QR standees are clean, standing upright, and placed next to check presentation trays.`,
    `2. Host Training: Train service staff to remind satisfied diners: "If you had a great experience, scan our standee to drop us a quick 5-star Google review!"`,
    `3. Fast Remediation: Check the HeReview Private Complaints inbox daily to follow up with dissatisfied guests before they post elsewhere.`,
  ];
  tips.forEach((t) => {
    doc.text(t, 14, y);
    y += 4.5;
  });

  // Footer
  doc.setDrawColor(226, 232, 240);
  doc.line(14, 282, pageWidth - 14, 282);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text('Confidential · Generated by HeReview B2B SaaS Platform · Tenant Isolation Enforced', 14, 287);
  doc.text(`Page 1 of 1`, pageWidth - 26, 287);

  // Trigger download
  const filename = `${business.slug}-monthly-report-${new Date().toISOString().slice(0, 7)}.pdf`;
  doc.save(filename);
}
