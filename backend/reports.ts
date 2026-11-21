import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { formatPHPText } from "@/shared/retail";
import type { RetailSnapshot, UnifiedCustomerRecord } from "@/shared/types";

export async function makeReport(
  data: RetailSnapshot,
  customer?: UnifiedCustomerRecord,
) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  pdf.setTitle(
    customer
      ? `${customer.customerId} - Customer 360`
      : "Karto Retail Sales & Compliance Report",
  );
  pdf.setAuthor("Karto Retail EDM");
  let page = pdf.addPage([595.28, 841.89]);
  let y = 750;

  // Strip non-WinAnsi characters so Helvetica encodes cleanly.
  const clean = (v: unknown) =>
    String(v)
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\x20-\x7E]/g, "*");

  const header = () => {
    page.drawRectangle({
      x: 0,
      y: 780,
      width: 596,
      height: 62,
      color: rgb(0.09, 0.09, 0.1),
    });
    page.drawText("Karto | Retail & E-Commerce EDM", {
      x: 42,
      y: 805,
      size: 14,
      font: bold,
      color: rgb(1, 1, 1),
    });
  };
  header();

  function line(text: string, heading = false) {
    const font = heading ? bold : regular;
    const size = heading ? 13 : 10;
    const words = clean(text).split(/\s+/);
    let row = "";
    const lines: string[] = [];
    for (const word of words) {
      if (font.widthOfTextAtSize((row ? row + " " : "") + word, size) > 505) {
        if (row) lines.push(row);
        row = "";
      }
      if (font.widthOfTextAtSize(word, size) > 505) {
        for (const char of word) {
          if (font.widthOfTextAtSize(row + char, size) > 505) {
            lines.push(row);
            row = "";
          }
          row += char;
        }
      } else {
        row += (row ? " " : "") + word;
      }
    }
    if (row) lines.push(row);
    if (heading) y -= 12;
    for (const item of lines) {
      if (y < 68) {
        page = pdf.addPage([595.28, 841.89]);
        header();
        y = 750;
      }
      page.drawText(item, {
        x: 42,
        y,
        size,
        font,
        color: rgb(0.12, 0.14, 0.17),
      });
      y -= 17;
    }
    y -= 5;
  }

  line(customer ? "Customer 360 Dossier" : "Unified Omnichannel Sales Report", true);
  line(`Generated: ${new Date().toISOString()} | Role: ${data.currentRole}`);
  line(`Branch scope: ${data.branchScope || "All channels (Manila, Cebu, Online)"}`);
  line("PCI DSS and GDPR permissions applied on the server before export.");

  if (customer) {
    line(`${customer.fullName} | ${customer.customerId}`, true);
    for (const [label, value] of Object.entries({
      "Loyalty Tier": `${customer.loyaltyTier} (${customer.pointsBalance} pts)`,
      "Preferred Branch": customer.preferredBranch,
      Email: customer.email,
      Phone: customer.phone,
      "GDPR Consent": customer.gdprConsent,
      "Payment Card": customer.maskedCardOnFile,
      "POS Spend": `${formatPHPText(customer.posSpend)} (${customer.posOrderCount} orders)`,
      "Online Spend": `${formatPHPText(customer.onlineSpend)} (${customer.onlineOrderCount} orders)`,
      "Total Spend": formatPHPText(customer.totalSpend),
      "Offer Status": `${customer.personalizedOffer.status} - ${customer.personalizedOffer.title}`,
    })) {
      line(`${label}: ${value}`);
    }
  } else {
    const s = data.salesSummary;
    line("Revenue & Fulfillment KPIs", true);
    line(
      `Total Revenue: ${formatPHPText(s.totalRevenue)} | Orders: ${s.totalOrders} | Avg Order: ${formatPHPText(s.averageOrderValue)} | 3PL On-Time: ${s.onTimeDeliveryRate}%`,
    );
    line(
      `Manila POS: ${formatPHPText(s.posManilaRevenue)} | Cebu POS: ${formatPHPText(s.posCebuRevenue)} | Online Storefront: ${formatPHPText(s.onlineRevenue)}`,
    );
    line("Category Breakdown", true);
    for (const cat of s.revenueByCategory) {
      line(`${cat.category}: ${formatPHPText(cat.revenue)} (${cat.units} units)`);
    }
    line("Stock Sync Snapshot", true);
    for (const item of data.stockItems) {
      line(
        `${item.sku} - ${item.productName}: Manila ${item.manilaStock} | Cebu ${item.cebuStock} | Online ${item.warehouseStock} | Status: ${item.stockStatus}`,
      );
    }
  }

  pdf.getPages().forEach((p, i) => {
    p.drawText(
      `Karto | Retail & E-Commerce EDM | ${i + 1} / ${pdf.getPageCount()}`,
      { x: 42, y: 32, size: 8, font: regular, color: rgb(0.4, 0.45, 0.52) },
    );
  });
  return pdf.save();
}
