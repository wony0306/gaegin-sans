// 1. 요소 가져오기
const textInput = document.getElementById("textInput");
const heightSlider = document.getElementById("heightSlider");
const middleSlider = document.getElementById("middleSlider");
const heightVal = document.getElementById("heightVal");
const middleVal = document.getElementById("middleVal");

const menuBtn = document.getElementById("menuBtn");
const sideMenu = document.getElementById("sideMenu");
const idleScreen = document.getElementById("idleScreen");

// 2. 폰트 스타일 업데이트 함수 (메인 화면용)
function updateStyles() {
  const hValue = heightSlider.value;
  const mValue = middleSlider.value;

  heightVal.innerText = hValue;
  middleVal.innerText = mValue;

  if (textInput) {
    textInput.style.fontVariationSettings = `"HGHT" ${hValue}, "MDLE" ${mValue}`;
  }
}

// 3. 입력창 자동 높이 조절
if (textInput) {
  textInput.addEventListener("input", () => {
    textInput.style.height = "auto";
    textInput.style.height = textInput.scrollHeight + "px";
  });
}

// 4. 슬라이더 이벤트 리스너 연결
if (heightSlider && middleSlider) {
  heightSlider.addEventListener("input", updateStyles);
  middleSlider.addEventListener("input", updateStyles);
}

// 5. 햄버거 메뉴 토글
if (menuBtn && sideMenu) {
  menuBtn.addEventListener("click", () => {
    sideMenu.classList.toggle("open");
  });
}

// --- 6. 유휴 상태(Idle) 감지 및 잠자는 화면 제어 ---
let idleTimer = null;
const IDLE_TIME_LIMIT = 300000; // 5분 후 잠자기 모드 진입

function showIdleScreen() {
  if (idleScreen) {
    idleScreen.classList.add("active"); // 이 클래스가 붙으면 CSS 애니메이션이 자동 시작됨!
  }
}

function resetIdleTimer() {
  if (idleScreen && idleScreen.classList.contains("active")) {
    idleScreen.classList.remove("active");
  }

  clearTimeout(idleTimer);
  idleTimer = setTimeout(showIdleScreen, IDLE_TIME_LIMIT);
}

const events = ["mousemove", "keydown", "mousedown", "touchstart", "scroll"];
events.forEach((eventName) => {
  window.addEventListener(eventName, resetIdleTimer);
});

// 초기 실행
updateStyles();
resetIdleTimer();
if (document.fonts && document.fonts.check) {
  document.fonts.check('16px "GeginSansCustom"');
}

// 최초 1회 실행 및 폰트 체크
updateStyles();
if (document.fonts && document.fonts.check) {
  document.fonts.check('16px "LongSans"');
}

const arduinoBtn = document.getElementById("arduinoBtn");

let activePort = null;
let isConnecting = false;

// [1] 시리얼 읽기 및 자동 유지 로직
async function startSerialRead(port) {
  if (isConnecting) return;
  isConnecting = true;
  activePort = port;

  try {
    // 포트가 닫혀있을 때만 open
    if (!port.readable) {
      await port.open({ baudRate: 115200 });
    }

    if (arduinoBtn) {
      arduinoBtn.innerText = "✅ 연결 완료 (자동 유지 중)";
      arduinoBtn.style.background = "#28a745";
    }

    const textDecoder = new TextDecoderStream();
    port.readable.pipeTo(textDecoder.writable);
    const reader = textDecoder.readable.getReader();

    let buffer = "";
    isConnecting = false;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += value;
      const lines = buffer.split("\n");
      buffer = lines.pop(); // 미완성 데이터 보관

      for (const line of lines) {
        const cleanLine = line.trim();
        if (cleanLine) {
          const [rawH, rawM] = cleanLine.split(",").map(Number);
          if (!isNaN(rawH) && !isNaN(rawM)) {
            applyArduinoToSliders(rawH, rawM);

            if (typeof resetIdleTimer === "function") {
              resetIdleTimer();
            }
          }
        }
      }
    }
  } catch (err) {
    console.error("통신 중단/에러:", err);
  } finally {
    isConnecting = false;
    activePort = null;
    if (arduinoBtn) {
      arduinoBtn.innerText = "🔌 연결 끊김 (자동 재연결 대기)";
      arduinoBtn.style.background = "#dc3545";
    }
  }
}

// [2] 승인된 아두이노 장치 찾아 연결하는 함수
async function tryAutoConnect() {
  if (activePort || isConnecting || !("serial" in navigator)) return;

  try {
    const ports = await navigator.serial.getPorts();
    if (ports.length > 0) {
      console.log("등록된 아두이노 감지, 자동 연결 시도...");
      await startSerialRead(ports[0]);
    }
  } catch (err) {
    console.error("자동 연결 체크 오류:", err);
  }
}

// [3] 페이지 로드 시 즉시 자동 연결
window.addEventListener("DOMContentLoaded", () => {
  tryAutoConnect();

  // [4] 5분(300,000ms)마다 연결 상태 점검 및 끊겼으면 자동 재연결
  // 테스트해보시려면 10000 (10초)으로 줄여서 확인해보세요!
  setInterval(
    () => {
      console.log("주기적 연결 상태 점검 중...");
      tryAutoConnect();
    },
    5 * 60 * 1000,
  );
});

// [5] 버튼 클릭 시 (최초 승인 등록용)
if (arduinoBtn) {
  arduinoBtn.addEventListener("click", async () => {
    try {
      if (!("serial" in navigator)) {
        alert("이 브라우저는 Web Serial API를 지원하지 않습니다.");
        return;
      }

      const ports = await navigator.serial.getPorts();
      let port;

      if (ports.length > 0) {
        port = ports[0];
      } else {
        // 승인된 장치가 없으면 팝업창 띄움
        port = await navigator.serial.requestPort();
      }

      await startSerialRead(port);
    } catch (err) {
      console.error(err);
      alert("연결 실패: " + err.message);
    }
  });
}
