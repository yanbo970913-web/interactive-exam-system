/**
 * 數位邏輯 題庫
 */
const digitalLogicQuestions = [
  {
    type: 'choice',
    level: 1,
    question_text: '二進位數 1010 轉換為十進位數是多少？',
    options: JSON.stringify(['10', '8', '12', '14']),
    correct_answer: '10',
    explanation: '二進位轉十進位：1010₂ = 1×2³ + 0×2² + 1×2¹ + 0×2⁰ = 8 + 0 + 2 + 0 = 10。'
  },
  {
    type: 'choice',
    level: 1,
    question_text: 'AND 閘的布林運算式為何？',
    options: JSON.stringify(['A·B', 'A+B', 'Ā', 'A⊕B']),
    correct_answer: 'A·B',
    explanation: 'AND 閘的布林運算式為 A·B（也寫作 AB）。兩個輸入都為 1 時，輸出才為 1。OR 閘為 A+B，NOT 閘為 Ā，XOR 閘為 A⊕B。'
  },
  {
    type: 'choice',
    level: 1,
    question_text: 'NOT 閘（反相器）的功能是什麼？',
    options: JSON.stringify(['將輸入信號反相（0→1, 1→0）', '當兩個輸入都為 1 時輸出 1', '當至少一個輸入為 1 時輸出 1', '輸出與輸入相同']),
    correct_answer: '將輸入信號反相（0→1, 1→0）',
    explanation: 'NOT 閘（反相器）將輸入信號反相：輸入 0 輸出 1，輸入 1 輸出 0。布林式為 Ā（A 的補數）。'
  },
  {
    type: 'choice',
    level: 1,
    question_text: 'NOR 閘（A=1, B=0）的輸出為何？',
    options: JSON.stringify(['0', '1', 'X（不確定）', '2']),
    correct_answer: '0',
    explanation: 'NOR 閘是 OR 閘後接 NOT 閘。A=1, B=0 時，OR 結果為 1，再經 NOT 反相得 0。NOR 閘只有在兩個輸入都為 0 時輸出才為 1。'
  },
  {
    type: 'choice',
    level: 2,
    question_text: '十六進位數 A3 轉換為十進位是多少？',
    options: JSON.stringify(['163', '153', '173', '143']),
    correct_answer: '163',
    explanation: '十六進位 A3：A 代表 10，3 代表 3。計算：10×16¹ + 3×16⁰ = 160 + 3 = 163。'
  },
  {
    type: 'choice',
    level: 2,
    question_text: '下列哪個邏輯閘被稱為「全功能閘」（Universal Gate）？',
    options: JSON.stringify(['NAND 閘', 'AND 閘', 'OR 閘', 'XOR 閘']),
    correct_answer: 'NAND 閘',
    explanation: 'NAND 閘和 NOR 閘都是「全功能閘」，因為僅用 NAND（或僅用 NOR）就能實現所有基本邏輯功能（AND、OR、NOT）。這在電路設計中很重要，可以只用一種閘製造所有電路。'
  },
  {
    type: 'choice',
    level: 2,
    question_text: "下列真值表對應哪個邏輯閘？\nA=0, B=0 → 0\nA=0, B=1 → 1\nA=1, B=0 → 1\nA=1, B=1 → 0",
    options: JSON.stringify(['XOR（互斥或）閘', 'AND 閘', 'OR 閘', 'XNOR 閘']),
    correct_answer: 'XOR（互斥或）閘',
    explanation: 'XOR（互斥或）閘：兩個輸入不同時輸出 1，相同時輸出 0。記憶方法：「相異出 1，相同出 0」。XNOR 則相反。'
  },
  {
    type: 'choice',
    level: 3,
    question_text: '使用卡諾圖（Karnaugh Map）化簡布林函數的目的是什麼？',
    options: JSON.stringify(['消除多餘的邏輯項，得到最簡化的布林表示式', '將電路轉換為 NAND 閘實現', '驗證電路的時序正確性', '將真值表轉換為邏輯閘']),
    correct_answer: '消除多餘的邏輯項，得到最簡化的布林表示式',
    explanation: '卡諾圖（K-Map）是一種視覺化的布林代數化簡工具。透過將相鄰的 1 分組（群），可以找出並消除多餘的變數，得到最簡的積之和（SOP）或和之積（POS）表示式，從而減少所需的邏輯閘數量。'
  },
  {
    type: 'choice',
    level: 3,
    question_text: '半加法器（Half Adder）的輸出包含哪兩個信號？',
    options: JSON.stringify(['Sum（和）與 Carry（進位）', 'Sum（和）與 Borrow（借位）', '進位與借位', '高位元與低位元']),
    correct_answer: 'Sum（和）與 Carry（進位）',
    explanation: '半加法器計算兩個一位元二進位數的加法，輸出：Sum（和）= A XOR B，Carry（進位）= A AND B。但半加法器不處理來自前一位的進位輸入，這是它與全加法器的差異。'
  },
  {
    type: 'choice',
    level: 3,
    question_text: '正反器（Flip-Flop）的主要功能是什麼？',
    options: JSON.stringify(['儲存一個位元的狀態（記憶元件）', '執行邏輯運算', '產生時脈信號', '轉換信號電壓準位']),
    correct_answer: '儲存一個位元的狀態（記憶元件）',
    explanation: '正反器（Flip-Flop）是一種雙穩態電路，能儲存一個位元（0 或 1）的狀態。它是組成暫存器、計數器和記憶體的基本單元。常見種類有 SR、JK、D、T 型正反器。'
  },
  // 填充題
  {
    type: 'fill',
    level: 1,
    question_text: '請將十進位數 13 轉換為二進位數（填入結果，不含前置零）：',
    options: null,
    correct_answer: '1101',
    explanation: '十進位轉二進位：13 ÷ 2 = 6 餘 1；6 ÷ 2 = 3 餘 0；3 ÷ 2 = 1 餘 1；1 ÷ 2 = 0 餘 1。從最後的餘數往回讀：1101。驗證：8+4+0+1=13 ✓'
  },
  {
    type: 'fill',
    level: 2,
    question_text: "德摩根定理（De Morgan's Theorem）第一定律：\n\n(A·B)的補數 = Ā ___ B̄\n\n請填入邏輯運算符號（AND 填 · ，OR 填 +）：",
    options: null,
    correct_answer: '+',
    explanation: '德摩根定理第一定律：(A·B)的補數 = Ā + B̄（AND 的補數等於 OR 的補數）。第二定律：(A+B)的補數 = Ā · B̄（OR 的補數等於 AND 的補數）。記憶口訣：「AND 變 OR，OR 變 AND，各自補數」。'
  },
  {
    type: 'fill',
    level: 2,
    question_text: '二進位加法：1011 + 0110 = ___（填入二進位結果）',
    options: null,
    correct_answer: '10001',
    explanation: '二進位加法（逐位相加，注意進位）：\n  1011\n+ 0110\n------\n 10001\n最低位：1+0=1；第二位：1+1=10（寫0進1）；第三位：0+1+1（進位）=10（寫0進1）；最高位：1+0+1（進位）=10。結果：10001（十進位：16+1=17，驗證：11+6=17 ✓）'
  },
  {
    type: 'fill',
    level: 3,
    question_text: '一個 4 位元二進位計數器，最多可以計數到多少（以十進位表示）？',
    options: null,
    correct_answer: '15',
    explanation: '4 位元計數器有 2⁴ = 16 種狀態，從 0000 到 1111。轉換為十進位：最大值為 1111₂ = 8+4+2+1 = 15。所以可計數範圍為 0~15，共 16 個數值。'
  }
];

module.exports = digitalLogicQuestions;
