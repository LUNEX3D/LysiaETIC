/**
 * PWA İkon Oluşturucu
 * Node.js ile çalıştırın: node create-icons.js
 * Bu script, canvas kullanarak basit PWA ikonları oluşturur.
 * Not: Bu script opsiyoneldir. İkonları manuel olarak da oluşturabilirsiniz.
 */

const fs = require('fs');
const { createCanvas } = (() => {
    try {
        return require('canvas');
    } catch (e) {
        console.log('canvas modülü bulunamadı. SVG tabanlı placeholder ikonlar oluşturuluyor...');
        return { createCanvas: null };
    }
})();

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

// canvas modülü yoksa SVG tabanlı basit PNG placeholder oluştur
function createPlaceholderSVG(size) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0f766e"/>
      <stop offset="100%" style="stop-color:#0ea5e9"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${size * 0.18}" fill="url(#bg)"/>
  <text x="50%" y="52%" dominant-baseline="middle" text-anchor="middle"
        font-family="Segoe UI, sans-serif" font-weight="bold"
        font-size="${size * 0.38}" fill="white">LE</text>
</svg>`;
}

sizes.forEach(size => {
    const filename = `icon-${size}x${size}.png`;

    if (createCanvas) {
        const canvas = createCanvas(size, size);
        const ctx = canvas.getContext('2d');

        const gradient = ctx.createLinearGradient(0, 0, size, size);
        gradient.addColorStop(0, '#0f766e');
        gradient.addColorStop(1, '#0ea5e9');
        ctx.fillStyle = gradient;

        const r = size * 0.18;
        ctx.beginPath();
        ctx.moveTo(r, 0);
        ctx.lineTo(size - r, 0);
        ctx.quadraticCurveTo(size, 0, size, r);
        ctx.lineTo(size, size - r);
        ctx.quadraticCurveTo(size, size, size - r, size);
        ctx.lineTo(r, size);
        ctx.quadraticCurveTo(0, size, 0, size - r);
        ctx.lineTo(0, r);
        ctx.quadraticCurveTo(0, 0, r, 0);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${size * 0.38}px "Segoe UI"`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('LE', size / 2, size / 2);

        const buffer = canvas.toBuffer('image/png');
        fs.writeFileSync(filename, buffer);
        console.log(`✅ ${filename} oluşturuldu`);
    } else {
        // SVG olarak kaydet (tarayıcıda PNG'ye dönüştürülebilir)
        const svgFilename = `icon-${size}x${size}.svg`;
        fs.writeFileSync(svgFilename, createPlaceholderSVG(size));
        console.log(`📄 ${svgFilename} oluşturuldu (SVG placeholder)`);
    }
});

console.log('\n🎉 İkon oluşturma tamamlandı!');
console.log('💡 PNG ikonlar için generate-icons.html dosyasını tarayıcıda açıp ikonları indirebilirsiniz.');
