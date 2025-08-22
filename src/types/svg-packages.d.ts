// Type declarations for upng-js
declare module 'upng-js' {
	interface UPNGImage {
		width: number;
		height: number;
		depth: number;
		ctype: number;
		frames: any[];
		tabs: any;
	}
	
	function decode(buffer: ArrayBuffer): UPNGImage;
	function toRGBA8(img: UPNGImage, p?: number): Uint8Array[];
}

// Type declarations for fit-curve
declare module 'fit-curve' {
	function fitCurve(points: [number, number][], maxError: number): [number, number][][];
	export = fitCurve;
}