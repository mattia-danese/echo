import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    // Read the VCF file from the public directory
    const vcfPath = path.join(process.cwd(), "public", "echo-embedded.vcf");
    const vcfContent = fs.readFileSync(vcfPath, "utf-8");

    // Return with correct MIME type for vCard
    return new NextResponse(vcfContent, {
      status: 200,
      headers: {
        "Content-Type": "text/vcard; charset=utf-8",
        "Content-Disposition": 'inline; filename="echo.vcf"',
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("Error serving VCF:", error);
    return new NextResponse("VCF file not found", { status: 404 });
  }
}

