const canvas = document.getElementById('bg-canvas');
const gl = canvas.getContext('webgl');

if (!gl) {
    console.error('WebGL not supported');
}

const vertexSource = `
    attribute vec2 position;
    void main() {
        gl_Position = vec4(position, 0.0, 1.0);
    }
`;

const fragmentSource = `
    precision highp float;
    uniform float time;
    uniform vec2 resolution;

    // Simplex 2D noise
    vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
    float snoise(vec2 v){
      const vec4 C = vec4(0.211324865405187, 0.366025403784439,
               -0.577350269189626, 0.024390243902439);
      vec2 i  = floor(v + dot(v, C.yy) );
      vec2 x0 = v -   i + dot(i, C.xx);
      vec2 i1;
      i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
      vec4 x12 = x0.xyxy + C.xxzz;
      x12.xy -= i1;
      i = mod(i, 289.0);
      vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
      + i.x + vec3(0.0, i1.x, 1.0 ));
      vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
        dot(x12.zw,x12.zw)), 0.0);
      m = m*m ;
      m = m*m ;
      vec3 x = 2.0 * fract(p * C.www) - 1.0;
      vec3 h = abs(x) - 0.5;
      vec3 ox = floor(x + 0.5);
      vec3 a0 = x - ox;
      m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
      vec3 g;
      g.x  = a0.x  * x0.x  + h.x  * x0.y;
      g.yz = a0.yz * x12.xz + h.yz * x12.yw;
      return 130.0 * dot(m, g);
    }

    void main() {
        vec2 uv = gl_FragCoord.xy / resolution.xy;
        uv.x *= resolution.x / resolution.y;

        // ノイズの重なりで深みを出す
        float n = snoise(uv * 2.0 + time * 0.05);
        float flame = snoise(uv * 4.0 - vec2(0.0, time * 0.3));
        
        // 縄文パターン：サイン波の干渉を強める
        float pattern = sin(uv.x * 15.0 + n * 8.0) * cos(uv.y * 15.0 + flame * 4.0);
        float edge = 1.0 - smoothstep(0.0, 0.2, abs(pattern));

        // カラーパレットの再調整
        vec3 baseBlue = vec3(0.02, 0.05, 0.2); // より深く、重い青
        vec3 jomonRed = vec3(0.4, 0.1, 0.2);  // 鈍く光る赤
        vec3 neonCyan = vec3(0.0, 0.8, 1.0);  // 鋭いシアン

        // 色の合成
        vec3 finalColor = mix(baseBlue, jomonRed, flame * 0.5 + 0.5);
        
        // パターンの発光感を追加（加算的に乗せる）
        finalColor += neonCyan * edge * 0.6;
        
        // 中心からのビネット効果（四隅を暗くして中央を際立たせる）
        float vignette = 1.0 - length(uv - vec2(0.5 * resolution.x / resolution.y, 0.5)) * 0.5;
        finalColor *= max(vignette, 0.5);

        // スキャンライン（少し細くして繊細に）
        float scanline = 0.95 + 0.05 * sin(gl_FragCoord.y * 1.5 + time * 5.0);
        finalColor *= scanline;

        // 最後に 0.4 を掛けずに、露出を調整
        gl_FragColor = vec4(finalColor * 1.2, 1.0); 
    }
`;

function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);

const program = gl.createProgram();
gl.attachShader(program, vertexShader);
gl.attachShader(program, fragmentShader);
gl.linkProgram(program);
gl.useProgram(program);

const positionBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1,
     1, -1,
    -1,  1,
    -1,  1,
     1, -1,
     1,  1,
]), gl.STATIC_DRAW);

const positionLocation = gl.getAttribLocation(program, 'position');
gl.enableVertexAttribArray(positionLocation);
gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

const timeLocation = gl.getUniformLocation(program, 'time');
const resolutionLocation = gl.getUniformLocation(program, 'resolution');

function render(time) {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);

    gl.uniform1f(timeLocation, time * 0.001);
    gl.uniform2f(resolutionLocation, canvas.width, canvas.height);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    requestAnimationFrame(render);
}

requestAnimationFrame(render);
