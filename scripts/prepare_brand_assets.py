from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets" / "images"
BRAND_SOURCE = Path("/home/ubuntu/upload/1000023918.png")
ICON_SOURCE = Path("/home/ubuntu/webdev-static-assets/partner-sync-icon-compressed.png")


def save_optimized(source: Path, destination: Path, size: tuple[int, int]) -> None:
    image = Image.open(source).convert("RGB")
    image.thumbnail(size, Image.Resampling.LANCZOS)
    optimized = image.quantize(colors=128, method=Image.Quantize.MEDIANCUT)
    optimized.save(destination, format="PNG", optimize=True, compress_level=9)


def main() -> None:
    save_optimized(BRAND_SOURCE, ASSETS / "partner-sync-brand.png", (1024, 1024))
    for filename in ("icon.png", "splash-icon.png", "favicon.png", "android-icon-foreground.png"):
        save_optimized(ICON_SOURCE, ASSETS / filename, (768, 768))


if __name__ == "__main__":
    main()
