# 🚀 NOVA CLI — دليل الأوامر الشامل | Comprehensive Commands Guide

مرحباً بك في دليل الأوامر الرسمي لمنصة **NOVA** (Next-gen Orchestrated Virtual Assistant). هذا الملف يحتوي على جميع الأوامر والخيارات المتاحة للتحكم في المنصة وتشغيلها.

Welcome to the official commands guide for **NOVA**. This file documents all available options, subcommands, and interactive commands for the platform.

---

## 📌 1. تشغيل المنصة من الطرفية | CLI Startup Options

تُستخدم هذه الأوامر والخيارات عند تشغيل `nova` لأول مرة من خلال Terminal/CMD:
These options are used when executing `nova` from your terminal:

| الأمر (Command) | الوصف (Arabic Description) | Description (English) |
| :--- | :--- | :--- |
| `nova` | بدء التشغيل بالوضع التفاعلي (Interactive Mode) | Starts NOVA in interactive REPL mode. |
| `nova -m, --model <model>` | تحديد موديل Ollama للاستخدام عند بدء التشغيل | Specify a custom Ollama model on startup. |
| `nova --mode <mode>` | تحديد وضع التشغيل (`chat` \| `fast` \| `plan` \| `code` \| `agent`) | Select startup mode: `chat`, `fast`, `plan`, `code`, or `agent`. |
| `nova --cwd <path>` | تحديد مسار بيئة العمل للمشروع | Set a custom repository workspace directory. |
| `nova --no-animation` | تخطي الرسوم المتحركة وشعار البدء | Disable the startup logo animation. |
| `nova "-v"`, `nova "--version"` | عرض إصدار المنصة الحالي | View the current version of NOVA. |
| `nova "<prompt>"` | تشغيل أمر سريع بنظام الطلقة الواحدة والخروج فوراً | Run a one-shot prompt/command and exit. |

---

## 🖥️ 2. الأوامر الفرعية للمنصة | Platform Subcommands

توفر منصة NOVA خوادم إضافية للتحكم بالويب أو التفاعل عبر التلغرام:
NOVA provides background services for Web UI and Telegram interfaces:

### خادم واجهة الويب (NOVA Studio Web UI Server)
لفتح لوحة التحكم الرسومية المتقدمة:
To launch the interactive visual dashboard:
```bash
nova ui
```
* **خيارات إضافية (Options):**
  * `-p, --port <number>`: لتغيير منفذ الخادم (الافتراضي: `3141`).
  * Example: `nova ui --port 8080`

### خادم بوت تلغرام (Telegram Bot Service)
لتشغيل المنصة وربطها ببوت تلغرام للتحكم عن بعد:
To bind NOVA to a Telegram bot for remote orchestration:
```bash
nova telegram --token <BOT_TOKEN> --allowed <USER_ID_1>,<USER_ID_2>
```
* **المعاملات المطلوبة (Required Options):**
  * `-t, --token <string>`: توكن البوت الذي تم إنشاؤه من BotFather.
  * `-a, --allowed <user_ids>`: معرفات المستخدمين المصرح لهم بالتحكم (أرقام مفصولة بفاصلة `,`).

---

## 💬 3. الأوامر التفاعلية داخل المنصة | Interactive Slash Commands

عند تشغيل المنصة بالوضع التفاعلي، يمكنك إدخال الأوامر التالية مباشرة بسبقها بشرطة مائلة `/`:
Inside the interactive prompt or Studio chat, prefix your commands with `/`:

### 🧭 التحكم والمساعدة | System & Navigation
* **`/help`** (أو **`/h`**): عرض قائمة المساعدة والدعم للأوامر.
* **`/quit`** (أو **`/q`** أو **`/exit`**): إغلاق المنصة وحفظ الجلسة الحالية تلقائياً.
* **`/clear`** (أو **`/cls`**): مسح محتوى المحادثة والذاكرة المؤقتة.
* **`/status`**: لوحة معلومات لمراقبة صحة النظام، زمن التشغيل، وحجم الذاكرة.
* **`/theme <name>`**: تغيير ثيم الواجهة الرسومية للطرفية (مثال: `dark` | `light` | `dracula`).
* **`/config <key> [value]`**: عرض أو تعديل إعدادات التكوين الخاصة بالمنصة.

### 🧠 التحكم في الذكاء الاصطناعي | AI Orchestration
* **`/models`**: عرض قائمة بجميع موديلات Ollama المثبتة محلياً وحجم كل منها.
* **`/model <name>`**: التبديل الفوري لموديل الذكاء الاصطناعي النشط.
* **`/mode <mode>`**: تغيير وضعية التشغيل. الأوضاع المتاحة:
  * `chat`: محادثة تفاعلية عامة.
  * `fast`: تشغيل سريع بدون استخدام الأدوات (No Tools).
  * `plan`: إنشاء خطط العمل والتحليل قبل البدء.
  * `code`: التركيز على المهام البرمجية والتعديل التلقائي.
  * `agent`: التشغيل الذاتي والكامل لحل المشكلات المعقدة.
* **`/chat`**, **`/fast`**, **`/code`**, **`/agent`**: اختصارات سريعة للتبديل بين الأوضاع.

### 🏆 تتبع الأهداف والتخطيط | Goal & Plan Tracking
* **`/goal [objective]`** (أو **`/g`**): بدء تتبع هدف مشروع بروتوكولي متكامل، أو استعراض لوحة إنجاز المهام الحالية.
* **`/plan <goal>`**: إعطاء المنصة هدفاً لتوليد خطة عمل برمجية شاملة كملف Markdown تلقائياً.

### 💾 الذاكرة وجلسات العمل | Memory & Context Management
* **`/context`** (أو **`/ctx`**): عرض حجم استهلاك الذاكرة وحجم النطاق المتاح (Context Window).
* **`/compress`**: ضغط سياق المحادثة لحفظ التوكنز وتوسيع حجم الذاكرة.
* **`/save [name]`**: حفظ الجلسة الحالية باسم مخصص.
* **`/load <id>`**: استعادة محادثة سابقة باستخدام معرف الجلسة.
* **`/history`**: عرض قائمة المحادثات التي تم حفظها سابقاً وتاريخها.
* **`/export [md|json]`**: تصدير الجلسة الحالية كملف Markdown أو JSON إلى مسار عملك.

### 🛠️ الأدوات والتحليل البرمجي | Repository & Code Utilities
* **`/tools`**: سرد كافة الأدوات (Tools) المتاحة للمنصة والمصنفة حسب نوعها.
* **`/project`**: إجراء تحليل تلقائي لهيكل المشروع وتحديد لغته وإطاره البرمجي.
* **`/init`**: إنشاء ملف `NOVA.md` للتكوين والتنظيم المخصص داخل مجلد مشروعك.
* **`/test [custom_command]`**: تشغيل اختبارات المشروع تلقائياً أو عبر أمر مخصص وعرض تقرير بالنتائج.
* **`/review [file]`**: فحص برمجيات الملف المحدد أو مراجعة تغييرات Git المجهزة (staged/unstaged).
* **`/security [file]`**: فحص أمني للملف المختار للكشف عن الثغرات الأمنية والبيانات الحساسة المسربة.
* **`/edit`** (أو **`/e`**): فتح محرر خارجي (VS Code أو Notepad) لكتابة مدخلات طويلة أو باللغة العربية بسهولة.

---

## 📝 4. تلميحات مفيدة | Tips & Tricks

* **الكتابة متعددة الأسطر (Multi-line Input):**
  اكتب ثلاث علامات تنصيص `"""` واضغط Enter للبدء، ثم اكتب رسالتك بأي عدد من الأسطر، وعند الانتهاء اكتب `"""` مرة أخرى للإرسال.
  Type `"""` to open multi-line mode, write your prompt, and type `"""` again to submit.

* **تخصيص القواعد (NOVA.md):**
  عند تشغيل `/init` سينشأ ملف `NOVA.md`. يمكنك كتابة تعليمات مخصصة فيه (مثل طريقة كتابة الكود أو ملفات يجب تجاهلها)، وسيلتزم بها المساعد طوال عمله بالمشروع.
  Use `NOVA.md` to define style rules, folder architectures, and constraints that NOVA must obey.

---
💡 *منصة NOVA مطورة لتسهيل عملك البرمجي محلياً وبشكل كامل وآمن 100%.*
💡 *NOVA is designed to keep your development workspace isolated, secure, and fully open-source.*
