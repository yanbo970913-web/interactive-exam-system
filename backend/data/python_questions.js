/**
 * Python 程式設計 題庫
 * 包含選擇題與填充題
 */
const pythonQuestions = [
  // 選擇題
  {
    type: 'choice',
    level: 1,
    question_text: '下列哪個是 Python 中用來輸出文字的函數？',
    options: JSON.stringify(['print()', 'echo()', 'output()', 'write()']),
    correct_answer: 'print()',
    explanation: 'Python 使用 print() 函數將文字輸出到控制台。例如：print("Hello, World!") 會輸出 Hello, World!'
  },
  {
    type: 'choice',
    level: 1,
    question_text: '在 Python 中，如何建立一個空的列表（List）？',
    options: JSON.stringify(['[]', '{}', '()', '<>']),
    correct_answer: '[]',
    explanation: '在 Python 中，空方括號 [] 代表空列表。{} 代表空字典，() 代表空元組。'
  },
  {
    type: 'choice',
    level: 1,
    question_text: '下列哪個關鍵字用於定義 Python 函數？',
    options: JSON.stringify(['def', 'function', 'func', 'define']),
    correct_answer: 'def',
    explanation: 'Python 使用 def 關鍵字來定義函數。例如：def my_function(): 。其他語言可能用 function 或 func，但 Python 只用 def。'
  },
  {
    type: 'choice',
    level: 1,
    question_text: '執行 print(type(3.14)) 的輸出結果是？',
    options: JSON.stringify(["<class 'float'>", "<class 'int'>", "<class 'str'>", "<class 'number'>"]),
    correct_answer: "<class 'float'>",
    explanation: '3.14 是浮點數（float），所以 type(3.14) 回傳 <class \'float\'>。整數用 int，字串用 str 表示。'
  },
  {
    type: 'choice',
    level: 2,
    question_text: "下列程式碼的輸出為何？\n\nx = [1, 2, 3, 4, 5]\nprint(x[1:3])",
    options: JSON.stringify(['[2, 3]', '[1, 2]', '[2, 3, 4]', '[1, 2, 3]']),
    correct_answer: '[2, 3]',
    explanation: 'Python 切片 x[1:3] 取得索引 1（含）到索引 3（不含）的元素。索引從 0 開始，所以 x[1]=2, x[2]=3，結果為 [2, 3]。'
  },
  {
    type: 'choice',
    level: 2,
    question_text: '以下哪個方法可以將列表中的元素加入到另一個列表末尾？',
    options: JSON.stringify(['extend()', 'append()', 'insert()', 'add()']),
    correct_answer: 'extend()',
    explanation: 'extend() 將另一個可迭代物件的所有元素新增到列表末尾。append() 只新增單一元素，insert() 在指定位置插入，add() 不是列表的方法。'
  },
  {
    type: 'choice',
    level: 2,
    question_text: "下列哪個是 Python 中的字典（Dictionary）？",
    options: JSON.stringify(['{"name": "Alice", "age": 25}', '["name", "Alice", "age", 25]', '("name", "Alice", "age", 25)', '{"name", "Alice", "age", 25}']),
    correct_answer: '{"name": "Alice", "age": 25}',
    explanation: '字典使用大括號 {} 並以 鍵:值 配對組成。最後一個選項雖然也用 {}，但沒有冒號，那是集合（Set），不是字典。'
  },
  {
    type: 'choice',
    level: 3,
    question_text: '下列程式碼的輸出為何？\n\ndef counter():\n    count = 0\n    def increment():\n        nonlocal count\n        count += 1\n        return count\n    return increment\n\nc = counter()\nprint(c(), c(), c())',
    options: JSON.stringify(['1 2 3', '0 1 2', '1 1 1', '錯誤']),
    correct_answer: '1 2 3',
    explanation: '這是閉包（Closure）的應用。nonlocal 關鍵字讓 increment 能修改外層函數的 count 變數。每次呼叫 c() 都會讓 count 遞增，所以輸出 1 2 3。'
  },
  {
    type: 'choice',
    level: 3,
    question_text: '關於 Python 的 lambda 函數，下列敘述何者正確？',
    options: JSON.stringify(['lambda 是一種匿名函數，只能包含一個表達式', 'lambda 函數可以包含多個陳述式', 'lambda 函數不能帶有參數', 'lambda 是 Python 獨有的特性']),
    correct_answer: 'lambda 是一種匿名函數，只能包含一個表達式',
    explanation: 'lambda 函數是匿名的（沒有名字），語法為 lambda 參數: 表達式。它只能包含一個表達式（不能有多個陳述式或 return），適合簡單的函數操作。'
  },
  {
    type: 'choice',
    level: 3,
    question_text: '使用列表生成式（List Comprehension），下列哪段程式碼等同於：\n\nresult = []\nfor i in range(10):\n    if i % 2 == 0:\n        result.append(i**2)',
    options: JSON.stringify(['[i**2 for i in range(10) if i % 2 == 0]', '[i**2 if i % 2 == 0 for i in range(10)]', '[i**2 for i in range(10) when i % 2 == 0]', '[for i in range(10) if i % 2 == 0: i**2]']),
    correct_answer: '[i**2 for i in range(10) if i % 2 == 0]',
    explanation: '列表生成式語法：[表達式 for 變數 in 可迭代物件 if 條件]。條件放在 for 迴圈後面，而不是表達式和 for 之間。'
  },
  // 填充題
  {
    type: 'fill',
    level: 1,
    question_text: "執行以下程式碼的輸出結果是什麼？\n\nmy_list = [10, 20, 30]\nprint(len(my_list))",
    options: null,
    correct_answer: '3',
    explanation: 'len() 函數回傳物件的長度。my_list 有 3 個元素（10, 20, 30），所以 len(my_list) = 3。'
  },
  {
    type: 'fill',
    level: 2,
    question_text: "請填入正確關鍵字，讓此程式碼成立（處理例外）：\n\ntry:\n    x = 1 / 0\n___ Exception as e:\n    print('發生錯誤:', e)",
    options: null,
    correct_answer: 'except',
    explanation: 'Python 的例外處理使用 try...except 結構。try 區塊包含可能出錯的程式碼，except 區塊處理錯誤。'
  },
  {
    type: 'fill',
    level: 2,
    question_text: "下列程式碼的輸出結果為何？\n\nwords = ['cat', 'dog', 'bird']\nprint(' '.join(words))",
    options: null,
    correct_answer: 'cat dog bird',
    explanation: 'str.join(iterable) 方法用指定字串將可迭代物件的元素連接起來。\' \'.join([\'cat\', \'dog\', \'bird\']) 用空格連接，結果為 "cat dog bird"。'
  },
  {
    type: 'fill',
    level: 3,
    question_text: "以下裝飾器（Decorator）語法中，@property 使 get_name 成為一個屬性讀取器。如果我們要讓 name 也可以被設定值，需要使用什麼裝飾器？\n\nclass Person:\n    def __init__(self, name):\n        self._name = name\n    @property\n    def get_name(self):\n        return self._name\n\n請填入設定器的裝飾器名稱（格式：@xxx.setter）中的 xxx 部分：",
    options: null,
    correct_answer: 'get_name',
    explanation: 'Python 的屬性設定器裝飾器格式為 @屬性名稱.setter。由於讀取器名稱為 get_name，所以設定器應使用 @get_name.setter。'
  },
  {
    type: 'choice',
    level: 4,
    question_text: '關於 Python 的 GIL（Global Interpreter Lock），下列敘述何者正確？',
    options: JSON.stringify([
      'GIL 限制 CPython 同一時間只有一個執行緒執行 Python 位元組碼',
      'GIL 讓多執行緒程式在多核心 CPU 上能完全並行',
      'GIL 只影響 I/O 密集型任務，不影響 CPU 密集型任務',
      'GIL 已在 Python 3.12 中被完全移除'
    ]),
    correct_answer: 'GIL 限制 CPython 同一時間只有一個執行緒執行 Python 位元組碼',
    explanation: 'GIL 是 CPython 實作中的互斥鎖，確保同一時間只有一個執行緒執行 Python 位元組碼。這使 CPU 密集型任務無法真正並行，但 I/O 操作期間會釋放 GIL，允許其他執行緒執行。Python 3.13 開始提供無 GIL 的實驗性支援。'
  }
];

module.exports = pythonQuestions;
