from abc import ABC, abstractmethod
from typing import Optional

class CropStrategy(ABC):
    """
    Base abstraction for converting horizontal/standard videos into 9:16 vertical (1080x1920) outputs.
    """
    @abstractmethod
    def get_ffmpeg_filter(self, input_width: int, input_height: int) -> str:
        pass

class CenterCropStrategy(CropStrategy):
    """
    Crops the center 9:16 area of the original video and scales to 1080x1920.
    """
    def get_ffmpeg_filter(self, input_width: int, input_height: int) -> str:
        # If already vertical 9:16
        if abs((input_width / max(1, input_height)) - (9 / 16)) < 0.05:
            return "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2"
            
        # Target 9:16 crop box from horizontal source
        # crop_w = input_height * 9 / 16
        # crop_h = input_height
        # x_offset = (input_width - crop_w) / 2
        return (
            "crop='min(iw,ih*9/16)':'min(ih,iw*16/9)':"
            "'(iw-min(iw,ih*9/16))/2':'(ih-min(ih,iw*16/9))/2',"
            "scale=1080:1920:flags=lanczos"
        )

class BlurBackgroundStrategy(CropStrategy):
    """
    Scales the video to fit 1080x1920 in the center while rendering a heavily blurred,
    zoomed background underneath to fill the 9:16 canvas.
    """
    def get_ffmpeg_filter(self, input_width: int, input_height: int) -> str:
        return (
            "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=25:5[bg];"
            "[0:v]scale=1080:1920:force_original_aspect_ratio=decrease[fg];"
            "[bg][fg]overlay=(W-w)/2:(H-h)/2"
        )

class CustomCropStrategy(CropStrategy):
    """
    Allows panning the 9:16 crop window across the horizontal frame (0% left to 100% right).
    """
    def __init__(self, pan_percent: float = 50.0):
        self.pan_percent = max(0.0, min(100.0, pan_percent))

    def get_ffmpeg_filter(self, input_width: int, input_height: int) -> str:
        factor = self.pan_percent / 100.0
        return (
            f"crop='min(iw,ih*9/16)':'min(ih,iw*16/9)':"
            f"'(iw-min(iw,ih*9/16))*{factor:.3f}':'(ih-min(ih,iw*16/9))/2',"
            f"scale=1080:1920:flags=lanczos"
        )

class FaceTrackingStrategy(CropStrategy):
    """
    Extensible stub for future AI face tracking and dynamic speaker framing.
    """
    def __init__(self):
        self.center_fallback = CenterCropStrategy()

    def get_ffmpeg_filter(self, input_width: int, input_height: int) -> str:
        # Uses CenterCrop until local face tracking model pipeline is enabled
        return self.center_fallback.get_ffmpeg_filter(input_width, input_height)

def get_crop_strategy(mode: str, pan_percent: Optional[float] = 50.0) -> CropStrategy:
    mode_lower = (mode or "center").lower()
    if mode_lower == "blur" or mode_lower == "blurred":
        return BlurBackgroundStrategy()
    elif mode_lower == "custom":
        return CustomCropStrategy(pan_percent or 50.0)
    elif mode_lower == "face_tracking":
        return FaceTrackingStrategy()
    else:
        return CenterCropStrategy()
