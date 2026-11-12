/**
 * Prestige hero "film": a tiny WebGL renderer (no library) that shows one photo per chapter
 * with a slow push-in, then wipes to the next photo with a soft noisy edge, a gold light seam
 * and a little motion blur. Scroll progress (0..1) drives everything, so it is fully scrubbable.
 *
 * If WebGL is unavailable, `FilmRenderer.create` returns null and the template's stacked
 * <img> fallback (cross-fade) is used instead.
 */

const VERT = `attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;v.y=1.-v.y;gl_Position=vec4(p,0.,1.);}`;

const FRAG = `precision mediump float;
uniform sampler2D tA,tB;uniform float mixv,zA,zB,aA,aB,warp;uniform vec2 res;varying vec2 v;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
vec2 cover(vec2 uv,float a,float z){float s=res.x/res.y;vec2 c=uv-.5;if(s>a)c.y*=a/s;else c.x*=s/a;return c/z+.5;}
vec3 tap(sampler2D t,vec2 uv,float a,float z,vec2 off){return texture2D(t,cover(uv+off,a,z)).rgb;}
void main(){
  vec2 uv=v;float m=mixv*1.4-.2;float nn=n(uv*vec2(3.,6.)+mixv*2.);
  float d=uv.x*.7+nn*.3-m;float edge=smoothstep(-.18,.18,d);
  vec2 dir=vec2(.016*warp,0.);vec3 a=vec3(0.),b=vec3(0.);
  for(int i=0;i<5;i++){float k=float(i)/4.;a+=tap(tA,uv,aA,zA,-dir*k);b+=tap(tB,uv,aB,zB,dir*(1.-k));}
  a/=5.;b/=5.;
  vec3 col=mix(b,a,edge);
  float seam=exp(-pow(d*16.,2.))*warp;
  col+=vec3(.72,.57,.35)*seam*.9;
  float vig=smoothstep(1.15,.35,length((uv-.5)*vec2(1.25,1.)));
  col*=mix(.55,1.,vig);
  gl_FragColor=vec4(col,1.);
}`;

export class FilmRenderer {
  private textures: (WebGLTexture | null)[] = [];
  private aspects: number[] = [];
  private loaded: boolean[] = [];
  private u: Record<string, WebGLUniformLocation | null> = {};
  private progress = 0;

  private constructor(
    private readonly gl: WebGLRenderingContext,
    private readonly canvas: HTMLCanvasElement,
    private readonly prog: WebGLProgram,
  ) {}

  /** onReady fires when the first photo is on screen (show the canvas then, not before). */
  static create(canvas: HTMLCanvasElement, urls: string[], onReady?: () => void): FilmRenderer | null {
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, preserveDrawingBuffer: false });
    if (!gl) return null;
    const shader = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    };
    const vs = shader(gl.VERTEX_SHADER, VERT);
    const fs = shader(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return null;
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const r = new FilmRenderer(gl, canvas, prog);
    for (const name of ['tA', 'tB', 'mixv', 'zA', 'zB', 'aA', 'aB', 'warp', 'res']) r.u[name] = gl.getUniformLocation(prog, name);
    gl.uniform1i(r.u['tA'], 0);
    gl.uniform1i(r.u['tB'], 1);
    urls.forEach((url, i) => r.load(url, i, i === 0 ? onReady : undefined));
    return r;
  }

  private load(url: string, i: number, done?: () => void): void {
    const gl = this.gl;
    this.aspects[i] = 1.25;
    this.loaded[i] = false;
    const tex = gl.createTexture();
    this.textures[i] = tex;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    // 1x1 charcoal until the photo arrives
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([16, 16, 19, 255]));
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this.aspects[i] = img.naturalWidth / img.naturalHeight;
      this.loaded[i] = true;
      this.draw(this.progress);
      done?.();
    };
    img.src = url;
  }

  resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.round(this.canvas.clientWidth * dpr);
    const h = Math.round(this.canvas.clientHeight * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.gl.viewport(0, 0, w, h);
    this.draw(this.progress);
  }

  /** p: 0..1 across the whole film. Each shot holds, then wipes to the next in its last 30%. */
  draw(p: number): void {
    this.progress = p;
    const gl = this.gl;
    const n = this.textures.length;
    if (!n) return;
    const seg = 1 / n;
    const i = Math.min(n - 1, Math.floor(p / seg));
    const local = (p - i * seg) / seg;
    const j = Math.min(n - 1, i + 1);
    const t = i === j ? 0 : Math.max(0, (local - 0.7) / 0.3);
    const ease = t * t * (3 - 2 * t);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.textures[i]);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.textures[j]);
    gl.uniform1f(this.u['mixv'], ease);
    gl.uniform1f(this.u['zA'], 1 + 0.12 * local);
    // The incoming shot starts at zoom 1, exactly where its own push-in begins: no jump
    gl.uniform1f(this.u['zB'], 1);
    gl.uniform1f(this.u['aA'], this.aspects[i]);
    gl.uniform1f(this.u['aB'], this.aspects[j]);
    gl.uniform1f(this.u['warp'], Math.sin(ease * Math.PI));
    gl.uniform2f(this.u['res'], this.canvas.width || 1, this.canvas.height || 1);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  get ready(): boolean {
    return this.loaded.some(Boolean);
  }

  destroy(): void {
    const gl = this.gl;
    this.textures.forEach((t) => t && gl.deleteTexture(t));
    gl.deleteProgram(this.prog);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
