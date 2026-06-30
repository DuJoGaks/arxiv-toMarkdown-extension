"""
Pre-download marker-pdf models.
Run this script once after installing dependencies to cache all required models
(~1.35GB) so that the first conversion doesn't have to wait.
"""

def main():
    print("Checking and downloading marker-pdf models...")
    print("This may take a few minutes on the first run.\n")

    try:
        from marker.models import create_model_dict
        from marker.converters.pdf import PdfConverter
        from marker.config.parser import ConfigParser

        print("Loading and downloading models via create_model_dict()...")
        model_dict = create_model_dict()

        config_parser = ConfigParser({"output_format": "markdown"})
        converter = PdfConverter(
            config=config_parser.generate_config_dict(),
            artifact_dict=model_dict
        )
        print("\nAll models are ready and cached.")
    except Exception as e:
        print(f"\nWarning: Model pre-download encountered an issue: {e}")
        print("Models will be downloaded automatically on first conversion.")


if __name__ == "__main__":
    main()
