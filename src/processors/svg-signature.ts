// SVG signature conversion using Zhang-Suen thinning algorithm + cubic Bézier smoothing
import * as UPNG from 'upng-js';
import fitCurve from 'fit-curve';
import { trace, posterize } from 'ts-potrace';

// Helper function to decode base64 to Uint8Array
function decodeBase64ToUint8(base64: string): Uint8Array {
	const comma = base64.indexOf(',');
	const b64 = base64.startsWith('data:') && comma >= 0 ? base64.slice(comma + 1) : base64;
	const bin = atob(b64);
	const out = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
	return out;
}

// Convert RGBA to binary bitmap (simple threshold)
function toBinary(rgba: Uint8Array, w: number, h: number, threshold = 150): Uint8Array {
	const bits = new Uint8Array(w * h);
	let inkCount = 0;
	let transparentCount = 0;
	let darkCount = 0;
	
	for (let i = 0, p = 0; i < rgba.length; i += 4, p++) {
		const r = rgba[i];
		const g = rgba[i + 1]; 
		const b = rgba[i + 2];
		const a = rgba[i + 3]; // alpha
		
		// Debug: log first few pixels
		if (p < 10) {
			console.log(`Pixel ${p}: R=${r} G=${g} B=${b} A=${a}`);
		}
		
		// Handle transparent pixels (background)
		if (a < 128) {
			bits[p] = 0; // transparent = background
			transparentCount++;
		} else {
			// For opaque pixels, check if they're dark (signature)
			const grayscale = 0.2126 * r + 0.7152 * g + 0.0722 * b;
			if (grayscale < threshold) {
				bits[p] = 1; // dark = ink
				inkCount++;
				darkCount++;
			} else {
				bits[p] = 0; // light = background
			}
		}
	}
	
	console.log(`Binary analysis: ${inkCount} ink pixels, ${transparentCount} transparent, ${darkCount} dark opaque`);
	console.log(`Total pixels: ${w * h}, threshold: ${threshold}`);
	
	return bits;
}

// Zhang-Suen thinning algorithm implementation
function zhangSuenThinning(binary: Uint8Array, width: number, height: number): Uint8Array {
	const result = new Uint8Array(binary);
	const idx = (x: number, y: number) => y * width + x;
	
	// 8-neighborhood offsets (clockwise from right)
	const neighbors = [
		[1, 0],   // P2
		[1, 1],   // P3  
		[0, 1],   // P4
		[-1, 1],  // P5
		[-1, 0],  // P6
		[-1, -1], // P7
		[0, -1],  // P8
		[1, -1]   // P9
	];
	
	const getNeighbors = (x: number, y: number): number[] => {
		return neighbors.map(([dx, dy]) => {
			const nx = x + dx;
			const ny = y + dy;
			if (nx < 0 || ny < 0 || nx >= width || ny >= height) return 0;
			return result[idx(nx, ny)];
		});
	};
	
	const countTransitions = (p: number[]): number => {
		let transitions = 0;
		for (let i = 0; i < 8; i++) {
			if (p[i] === 0 && p[(i + 1) % 8] === 1) {
				transitions++;
			}
		}
		return transitions;
	};
	
	const countNeighbors = (p: number[]): number => {
		return p.reduce((sum, val) => sum + val, 0);
	};
	
	let changed = true;
	let iteration = 0;
	
	while (changed && iteration < 100) { // Safety limit
		changed = false;
		iteration++;
		
		// Step 1
		const toRemove1: [number, number][] = [];
		
		for (let y = 1; y < height - 1; y++) {
			for (let x = 1; x < width - 1; x++) {
				if (result[idx(x, y)] !== 1) continue;
				
				const p = getNeighbors(x, y);
				const [p2, p3, p4, p5, p6, p7, p8, p9] = p;
				
				const bp1 = countNeighbors(p);
				const ap1 = countTransitions(p);
				
				if (bp1 >= 2 && bp1 <= 6 && 
					ap1 === 1 && 
					p2 * p4 * p6 === 0 && 
					p4 * p6 * p8 === 0) {
					toRemove1.push([x, y]);
				}
			}
		}
		
		// Remove step 1 pixels
		for (const [x, y] of toRemove1) {
			result[idx(x, y)] = 0;
			changed = true;
		}
		
		// Step 2
		const toRemove2: [number, number][] = [];
		
		for (let y = 1; y < height - 1; y++) {
			for (let x = 1; x < width - 1; x++) {
				if (result[idx(x, y)] !== 1) continue;
				
				const p = getNeighbors(x, y);
				const [p2, p3, p4, p5, p6, p7, p8, p9] = p;
				
				const bp1 = countNeighbors(p);
				const ap1 = countTransitions(p);
				
				if (bp1 >= 2 && bp1 <= 6 && 
					ap1 === 1 && 
					p2 * p4 * p8 === 0 && 
					p2 * p6 * p8 === 0) {
					toRemove2.push([x, y]);
				}
			}
		}
		
		// Remove step 2 pixels
		for (const [x, y] of toRemove2) {
			result[idx(x, y)] = 0;
			changed = true;
		}
		
		console.log(`Zhang-Suen iteration ${iteration}: removed ${toRemove1.length + toRemove2.length} pixels`);
	}
	
	console.log(`Zhang-Suen completed after ${iteration} iterations`);
	return result;
}

// Trace skeleton pixels into polylines (8-neighborhood)
function skeletonToPaths(bits: Uint8Array, w: number, h: number): number[][][] {
	const idx = (x: number, y: number) => y * w + x;
	const dirs = [[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]];
	const seen = new Uint8Array(bits.length);
	const degree = new Uint8Array(bits.length);

	// Calculate degree of each pixel (number of neighbors)
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			if (!bits[idx(x,y)]) continue;
			let count = 0;
			for (const [dx, dy] of dirs) {
				const nx = x + dx;
				const ny = y + dy;
				if (nx >= 0 && ny >= 0 && nx < w && ny < h && bits[idx(nx, ny)]) {
					count++;
				}
			}
			degree[idx(x, y)] = count;
		}
	}

	const paths: number[][][] = [];
	
	const visit = (startX: number, startY: number) => {
		const path: number[][] = [];
		let x = startX;
		let y = startY;
		let lastDirection = -1;
		
		while (true) {
			const id = idx(x, y);
			if (seen[id]) break;
			
			seen[id] = 1;
			path.push([x, y]);
			
			// Find next unvisited neighbor (prefer continuing in same direction)
			let nextPoint: [number, number] | null = null;
			let nextDirection = -1;
			
			for (let i = 0; i < 8; i++) {
				const [dx, dy] = dirs[i];
				const nx = x + dx;
				const ny = y + dy;
				const nId = idx(nx, ny);
				
				if (nx >= 0 && ny >= 0 && nx < w && ny < h && 
					bits[nId] && !seen[nId]) {
					nextPoint = [nx, ny];
					nextDirection = i;
					break;
				}
			}
			
			if (!nextPoint) break;
			
			x = nextPoint[0];
			y = nextPoint[1];
			lastDirection = nextDirection;
		}
		
		if (path.length > 1) {
			paths.push(path);
		}
	};

	// Start tracing from endpoints (degree <= 1), then junctions
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			if (bits[idx(x, y)] && degree[idx(x, y)] <= 1 && !seen[idx(x, y)]) {
				visit(x, y);
			}
		}
	}
	
	// Trace any remaining unvisited pixels
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			if (bits[idx(x, y)] && !seen[idx(x, y)]) {
				visit(x, y);
			}
		}
	}

	return paths;
}

// Ramer-Douglas-Peucker simplification (optional preprocessing)
function simplifyPath(points: [number, number][], epsilon = 1.0): [number, number][] {
	if (points.length <= 2) return points;
	
	// Find point with maximum distance from line between first and last points
	let maxDistance = 0;
	let maxIndex = 0;
	const [x1, y1] = points[0];
	const [x2, y2] = points[points.length - 1];
	
	for (let i = 1; i < points.length - 1; i++) {
		const [x0, y0] = points[i];
		// Distance from point to line formula
		const distance = Math.abs((y2 - y1) * x0 - (x2 - x1) * y0 + x2 * y1 - y2 * x1) / 
						Math.sqrt((y2 - y1) ** 2 + (x2 - x1) ** 2);
		
		if (distance > maxDistance) {
			maxDistance = distance;
			maxIndex = i;
		}
	}
	
	// If max distance is greater than epsilon, recursively simplify
	if (maxDistance > epsilon) {
		const left = simplifyPath(points.slice(0, maxIndex + 1), epsilon);
		const right = simplifyPath(points.slice(maxIndex), epsilon);
		return left.slice(0, -1).concat(right);
	} else {
		return [points[0], points[points.length - 1]];
	}
}

// Convert polyline to smooth cubic Bézier path
function polylineToCubicPath(points: [number, number][], fitError = 2.0): string {
	if (!points || points.length < 2) return '';
	
	// Optional: simplify path before fitting (reduces unnecessary detail)
	const simplifiedPoints = points.length > 10 ? simplifyPath(points, 0.8) : points;
	
	if (simplifiedPoints.length < 2) return '';
	
	try {
		// Fit cubic Bézier curves to the polyline
		const segments = fitCurve(simplifiedPoints, fitError);
		
		if (!segments || segments.length === 0) return '';
		
		// Build SVG path data
		const [x0, y0] = segments[0][0];
		let d = `M ${x0} ${y0}`;
		
		for (const segment of segments) {
			const [, p1, p2, p3] = segment;
			d += ` C ${p1[0]} ${p1[1]} ${p2[0]} ${p2[1]} ${p3[0]} ${p3[1]}`;
		}
		
		return d;
	} catch (error) {
		console.warn('Curve fitting failed, falling back to linear path:', error);
		// Fallback to simple linear path
		const start = simplifiedPoints[0];
		const moves = simplifiedPoints.slice(1).map(([x, y]) => `L${x} ${y}`).join(' ');
		return `M${start[0]} ${start[1]} ${moves}`;
	}
}

// Convert paths to smooth SVG with cubic Bézier curves
function pathsToSmoothSVG(paths: number[][][], strokeWidth = 1, w = 0, h = 0, fitError = 2.0): string {
	if (paths.length === 0) {
		return `<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" fill="none" stroke="black" stroke-width="${strokeWidth}"><text x="10" y="20" font-family="Arial" font-size="12">No paths found</text></svg>`;
	}
	
	// Convert each polyline to smooth cubic curves
	const pathStrings = paths
		.map(path => polylineToCubicPath(path as [number, number][], fitError))
		.filter(d => d.length > 0);
	
	if (pathStrings.length === 0) {
		return `<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" fill="none" stroke="black" stroke-width="${strokeWidth}"><text x="10" y="20" font-family="Arial" font-size="12">No valid paths after curve fitting</text></svg>`;
	}
	
	// Create separate path elements for better control
	const pathElements = pathStrings.map(d => `<path d="${d}" />`).join('\n  ');
	
	return `<?xml version="1.0"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" fill="none" stroke="black" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
  ${pathElements}
</svg>`;
}

// Convert base64 PNG signature to SVG using Zhang-Suen algorithm
export async function convertPngToSvg(base64Png: string | null, threshold = 150, strokeWidth = 1, fitError = 2.0): Promise<string | null> {
	if (!base64Png) {
		console.log('No base64 PNG data provided for SVG conversion');
		return null;
	}

	try {
		console.log('=== ZHANG-SUEN + CUBIC BÉZIER SVG CONVERSION ===');
		console.log(`Input: ${base64Png.length} character base64 string`);
		console.log(`Settings: threshold=${threshold}, strokeWidth=${strokeWidth}, fitError=${fitError}`);
		
		// 1) Decode base64 to binary
		const bytes = decodeBase64ToUint8(base64Png);
		console.log(`Decoded to ${bytes.length} bytes`);
		
		// 2) Decode PNG
		const png = UPNG.decode(bytes.buffer);
		const { width: w, height: h } = png;
		console.log(`PNG decoded: ${w}x${h} pixels, frames: ${png.frames?.length}, ctype: ${png.ctype}`);
		
		// Get RGBA data (handle different PNG formats)
		const rgbaArrays = UPNG.toRGBA8(png);
		console.log(`UPNG.toRGBA8 returned ${rgbaArrays?.length} arrays`);
		
		if (!rgbaArrays || rgbaArrays.length === 0) {
			console.error('Failed to convert PNG to RGBA format');
			return null;
		}
		
		let rgba = rgbaArrays[0];
		console.log(`RGBA array type: ${rgba?.constructor?.name}, length: ${rgba?.length}, expected: ${w * h * 4}`);
		
		// Convert ArrayBuffer to Uint8Array if needed
		if (rgba instanceof ArrayBuffer) {
			console.log('Converting ArrayBuffer to Uint8Array...');
			rgba = new Uint8Array(rgba);
			console.log(`Converted to Uint8Array, length: ${rgba.length}`);
		}
		
		if (!rgba || rgba.length !== w * h * 4) {
			console.error(`Invalid RGBA data: expected ${w * h * 4} bytes, got ${rgba?.length}`);
			return null;
		}

		// 3) Convert to binary bitmap
		console.log(`First 32 RGBA bytes: ${Array.from(rgba.slice(0, 32)).join(', ')}`);
		
		const binary = toBinary(rgba, w, h, threshold);
		const inkPixels = binary.reduce((sum, val) => sum + val, 0);
		console.log(`Binary conversion: ${inkPixels} ink pixels out of ${w * h} total`);

		// 4) Apply Zhang-Suen thinning
		const skeleton = zhangSuenThinning(binary, w, h);
		const skeletonPixels = skeleton.reduce((sum, val) => sum + val, 0);
		console.log(`Skeleton: ${skeletonPixels} pixels remaining after thinning`);

		// 5) Trace skeleton to paths
		const paths = skeletonToPaths(skeleton, w, h);
		console.log(`Path tracing: found ${paths.length} paths`);
		paths.forEach((path, i) => {
			console.log(`  Path ${i + 1}: ${path.length} points`);
		});

		// 6) Convert to smooth SVG with cubic Bézier curves
		const svg = pathsToSmoothSVG(paths, strokeWidth, w, h, fitError);
		console.log(`Generated smooth SVG: ${svg.length} characters`);
		
		// Generate preview URL for easy viewing
		const encodedSvg = encodeURIComponent(svg);
		const previewUrl = `http://localhost:58230/preview-svg?svg=${encodedSvg}`;
		console.log(`🎨 Preview URL: ${previewUrl}`);
		console.log('=== CONVERSION COMPLETE ===');
		
		return svg;

	} catch (error) {
		console.error('Error in Zhang-Suen SVG conversion:', error);
		return null;
	}
}

// Convert PNG URL directly to SVG using Zhang-Suen algorithm
export async function convertSignatureUrlToSvg(signatureUrl: string, apiKey: string, threshold = 150, strokeWidth = 1, fitError = 2.0): Promise<string | null> {
	try {
		console.log(`Fetching signature from URL: ${signatureUrl}`);
		
		// Fetch the PNG from JotForm as binary
		const imageResponse = await fetch(`${signatureUrl}?apiKey=${apiKey}`);
		if (!imageResponse.ok) {
			console.error(`Failed to fetch signature image: ${imageResponse.status}`);
			return null;
		}

		// Get binary data and convert to base64
		const arrayBuffer = await imageResponse.arrayBuffer();
		console.log(`Fetched PNG binary (${arrayBuffer.byteLength} bytes)`);
		
		// Convert to base64 for processing
		const bytes = new Uint8Array(arrayBuffer);
		const binaryString = Array.from(bytes).map(byte => String.fromCharCode(byte)).join('');
		const base64 = btoa(binaryString);
		const dataUri = `data:image/png;base64,${base64}`;
		
		console.log('Converted to base64, processing with Zhang-Suen...');
		
		// Process with Zhang-Suen algorithm
		return await convertPngToSvg(dataUri, threshold, strokeWidth, fitError);

	} catch (error) {
		console.error('Error converting signature URL to SVG:', error);
		return null;
	}
}

// Convert base64 PNG signature to SVG using ts-potrace
export async function convertPngToSvgPotrace(base64Png: string | null, options?: {
	background?: string;
	color?: string;
	threshold?: number;
}): Promise<string | null> {
	if (!base64Png) {
		console.log('No base64 PNG data provided for ts-potrace conversion');
		return null;
	}

	try {
		console.log('=== TS-POTRACE SVG CONVERSION ===');
		console.log(`Input: ${base64Png.length} character base64 string`);
		console.log(`Options:`, options);
		
		// Convert base64 to buffer for ts-potrace
		const bytes = decodeBase64ToUint8(base64Png);
		
		// Create a Promise-wrapped version of the trace function
		const svg = await new Promise<string>((resolve, reject) => {
			// ts-potrace expects a buffer, but we'll pass the Uint8Array directly
			trace(bytes as any, {
				background: options?.background || 'transparent',
				color: options?.color || 'black',
				threshold: options?.threshold || 120,
				...options
			}, (err, svg) => {
				if (err) {
					console.error('ts-potrace error:', err);
					reject(err);
				} else {
					resolve(svg || '');
				}
			});
		});
		
		console.log(`Generated ts-potrace SVG: ${svg.length} characters`);
		console.log('=== TS-POTRACE CONVERSION COMPLETE ===');
		
		return svg;

	} catch (error) {
		console.error('Error in ts-potrace SVG conversion:', error);
		return null;
	}
}

// Convert base64 PNG signature to SVG using ts-potrace posterization
export async function convertPngToSvgPosterized(base64Png: string | null, options?: {
	steps?: number | number[];
	fillStrategy?: 'dominant' | 'mean' | 'median';
	background?: string;
}): Promise<string | null> {
	if (!base64Png) {
		console.log('No base64 PNG data provided for ts-potrace posterization');
		return null;
	}

	try {
		console.log('=== TS-POTRACE POSTERIZATION ===');
		console.log(`Input: ${base64Png.length} character base64 string`);
		console.log(`Options:`, options);
		
		// Convert base64 to buffer for ts-potrace
		const bytes = decodeBase64ToUint8(base64Png);
		
		// Create a Promise-wrapped version of the posterize function
		const svg = await new Promise<string>((resolve, reject) => {
			posterize(bytes as any, {
				steps: options?.steps || 3,
				fillStrategy: options?.fillStrategy || 'dominant',
				background: options?.background || 'transparent',
				...options
			}, (err, svg) => {
				if (err) {
					console.error('ts-potrace posterization error:', err);
					reject(err);
				} else {
					resolve(svg || '');
				}
			});
		});
		
		console.log(`Generated posterized SVG: ${svg.length} characters`);
		console.log('=== TS-POTRACE POSTERIZATION COMPLETE ===');
		
		return svg;

	} catch (error) {
		console.error('Error in ts-potrace posterization:', error);
		return null;
	}
}

// Convert PNG URL to SVG using ts-potrace
export async function convertSignatureUrlToSvgPotrace(signatureUrl: string, apiKey: string, options?: {
	background?: string;
	color?: string;
	threshold?: number;
}): Promise<string | null> {
	try {
		console.log('=== TS-POTRACE URL CONVERSION ===');
		console.log(`Fetching signature from URL: ${signatureUrl}`);
		
		// Fetch the PNG image
		const response = await fetch(signatureUrl, {
			headers: {
				'APIKEY': apiKey
			}
		});

		if (!response.ok) {
			console.error(`Failed to fetch signature: ${response.status} ${response.statusText}`);
			return null;
		}

		// Convert to base64
		const arrayBuffer = await response.arrayBuffer();
		const uint8Array = new Uint8Array(arrayBuffer);
		const binaryString = Array.from(uint8Array, byte => String.fromCharCode(byte)).join('');
		const dataUri = `data:image/png;base64,${btoa(binaryString)}`;
		
		console.log('Converted to base64, processing with ts-potrace...');
		
		// Process with ts-potrace
		return await convertPngToSvgPotrace(dataUri, options);

	} catch (error) {
		console.error('Error converting signature URL to SVG with ts-potrace:', error);
		return null;
	}
}