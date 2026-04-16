export type CarouselOffset = {
  x: number;
  y: number;
};

export type CarouselPinchState = {
  distance: number;
  zoom: number;
  center: CarouselOffset;
  offset: CarouselOffset;
};

export type CarouselThumbPlacement = "side" | "bottom";
