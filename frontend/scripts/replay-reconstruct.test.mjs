// reconstructText 알고리즘 단독 검증용 스크립트.
// node frontend/scripts/replay-reconstruct.test.mjs

const reconstructText = (events, currentTime) => {
  let text = "";
  let pasteFlags = [];

  const applyEdit = (pos, removeLen, insert, isPaste) => {
    pos = Math.max(0, Math.min(pos, text.length));
    removeLen = Math.max(0, Math.min(removeLen, text.length - pos));
    text = text.slice(0, pos) + insert + text.slice(pos + removeLen);
    const insertFlags = new Array(insert.length).fill(isPaste);
    pasteFlags = [
      ...pasteFlags.slice(0, pos),
      ...insertFlags,
      ...pasteFlags.slice(pos + removeLen),
    ];
  };

  events.filter((e) => e.t <= currentTime).forEach((e) => {
    if (e.type === "KEYSTROKE") {
      const p = e.payload || {};
      if (typeof p.pos === "number") {
        applyEdit(p.pos, p.removeLen ?? 0, p.insert ?? "", false);
      } else {
        const action = p.action ?? "insert";
        const key = p.key ?? "";
        if (action === "insert") applyEdit(text.length, 0, key, false);
        else if (action === "delete" && text.length > 0) applyEdit(text.length - 1, 1, "", false);
      }
    } else if (e.type === "PASTE") {
      const preview = e.payload?.preview ?? "";
      const selectedLength = e.payload?.selectedLength ?? 0;
      const pos = typeof e.payload?.pos === "number" ? e.payload.pos : text.length;
      applyEdit(pos, selectedLength, preview, true);
    }
  });

  return text;
};

// 헬퍼: KEYSTROKE 이벤트 빌더
let _t = 0;
const K = (pos, removeLen, insert) => ({
  t: _t++,
  type: "KEYSTROKE",
  payload: { pos, removeLen, insert },
});
const P = (pos, selectedLength, preview) => ({
  t: _t++,
  type: "PASTE",
  payload: { pos, selectedLength, preview },
});
const reset = () => { _t = 0; };

// 테스트 러너
const cases = [];
const test = (name, events, expected) => {
  const actual = reconstructText(events, Infinity);
  const pass = actual === expected;
  cases.push({ name, pass, actual, expected });
};

// === 시나리오 ===

reset();
test(
  "기본 타이핑: abc",
  [K(0, 0, "a"), K(1, 0, "b"), K(2, 0, "c")],
  "abc"
);

reset();
test(
  "끝에서 백스페이스 1자",
  [K(0, 0, "a"), K(1, 0, "b"), K(2, 0, "c"), K(2, 1, "")],
  "ab"
);

reset();
test(
  "중간 삽입 (커서 이동 후 타이핑)",
  [K(0, 0, "a"), K(1, 0, "b"), K(2, 0, "c"), K(1, 0, "X")],
  "aXbc"
);

reset();
test(
  "중간 삭제 (커서 가운데 두고 Backspace)",
  [K(0, 0, "a"), K(1, 0, "b"), K(2, 0, "c"), K(0, 1, "")],
  "bc"
);

reset();
test(
  "선택 영역 교체 (abc 선택, 'X' 타이핑)",
  [K(0, 0, "a"), K(1, 0, "b"), K(2, 0, "c"), K(0, 3, "X")],
  "X"
);

reset();
test(
  "Ctrl+A + Backspace (전체 삭제)",
  [K(0, 0, "a"), K(1, 0, "b"), K(2, 0, "c"), K(0, 3, "")],
  ""
);

reset();
test(
  "개행 4줄 + 중간 줄 삭제",
  [
    K(0, 0, "a"), K(1, 0, "\n"),
    K(2, 0, "b"), K(3, 0, "\n"),
    K(4, 0, "c"), K(5, 0, "\n"),
    K(6, 0, "d"),
    // 두 번째 줄 'b\n' 선택 후 삭제
    K(2, 2, ""),
  ],
  "a\nc\nd"
);

reset();
test(
  "Paste over selection (Ctrl+A → Ctrl+V로 교체)",
  [
    K(0, 0, "기"), K(1, 0, "존"),
    P(0, 2, "새로운"),
  ],
  "새로운"
);

reset();
test(
  "Paste at middle position",
  [
    K(0, 0, "A"), K(1, 0, "B"), K(2, 0, "C"),
    P(1, 0, "X"),   // 'A' 와 'B' 사이에 paste
  ],
  "AXBC"
);

reset();
test(
  "IME 한글 + Ctrl+A + 다시 IME 한글",
  [
    K(0, 0, "안"),     // IME compositionend
    K(1, 0, "녕"),
    K(0, 2, "하"),     // Ctrl+A 후 IME로 '하' 입력 (선택 2자를 '하'로 치환)
    K(1, 0, "이"),
  ],
  "하이"
);

reset();
test(
  "Ctrl+A 후 Ctrl+V로 paste + 또 Ctrl+A + Backspace + 다시 paste",
  [
    K(0, 0, "테"), K(1, 0, "스"), K(2, 0, "트"),
    P(0, 3, "23123\n"),
    K(0, 6, ""),                 // Ctrl+A + Backspace
    P(0, 0, "23123\n"),          // 빈 textarea에 paste
  ],
  "23123\n"
);

reset();
test(
  "현재 가장 골치 케이스: 한글 여러 줄 + Ctrl+A + paste + 또 한글 + Ctrl+백 백 백 + 또 paste",
  [
    K(0, 0, "테"), K(1, 0, "스"), K(2, 0, "트"), K(3, 0, "\n"),
    K(4, 0, "테"), K(5, 0, "스"), K(6, 0, "테"),
    P(0, 7, "23123\n"),                // Ctrl+A + Ctrl+V
    K(0, 6, ""),                       // Ctrl+A + Backspace (이게 그동안 누락되던 케이스!)
    K(0, 0, "구"), K(1, 0, "구"), K(2, 0, "\n"),
    K(3, 0, "구"), K(4, 0, "구"), K(5, 0, "\n"),
    K(6, 0, "구"), K(7, 0, "구"),
    K(0, 8, ""),                       // 또 Ctrl+A + Backspace
    P(0, 0, "23123\n"),
  ],
  "23123\n"
);

reset();
test(
  "Cmd+Backspace 줄 단위 삭제 시뮬레이션",
  [
    K(0, 0, "a"), K(1, 0, "b"), K(2, 0, "c"), K(3, 0, "\n"),
    K(4, 0, "d"), K(5, 0, "e"), K(6, 0, "f"),
    // Cmd+Backspace: 현재 줄 시작까지 삭제. 커서 pos=7, 줄 시작=4, removeLen=3
    K(4, 3, ""),
  ],
  "abc\n"
);

reset();
test(
  "Ctrl+Backspace 단어 단위 삭제 시뮬레이션",
  [
    K(0, 0, "h"), K(1, 0, "e"), K(2, 0, "l"), K(3, 0, "l"), K(4, 0, "o"),
    K(5, 0, " "),
    K(6, 0, "w"), K(7, 0, "o"), K(8, 0, "r"), K(9, 0, "l"), K(10, 0, "d"),
    // Ctrl+Backspace: 'world' 단어 삭제 (pos=6 이전 단어 'world' 5자)
    K(6, 5, ""),
  ],
  "hello "
);

// === 결과 출력 ===

let passed = 0, failed = 0;
for (const c of cases) {
  const tag = c.pass ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m";
  console.log(`  ${tag}  ${c.name}`);
  if (!c.pass) {
    console.log(`         expected: ${JSON.stringify(c.expected)}`);
    console.log(`         actual:   ${JSON.stringify(c.actual)}`);
  }
  c.pass ? passed++ : failed++;
}
console.log(`\n  ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
