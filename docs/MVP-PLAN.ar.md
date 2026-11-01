# خطة التنفيذ المرحلية

التقدير تخطيطي لفريق صغير وليس موعد تسليم مضمون. لا تتطلب كل مرحلة موافقة جديدة للعمل الهندسي؛ الإنتاج وحده يبقى بموافقة المالك. أي مفاتيح مزود أو أسواق غير محددة تُسجل كاعتماد خارجي.

| المرحلة | المخرجات | بوابة القبول | تقدير أولي |
|---|---|---|---|
| 0 — الأساس | مراجعة المصدر والترخيص، مواصفات، بنية، بيانات، مستودع مستقل | لا كود من JobOps؛ وثائق وسجل قرارات | هذه الدفعة |
| 1 — مسار خادم | حسابات، شركات، وظائف، بحث، تقديم، حالات، رسائل وصندوق إشعارات | اختبارات تكامل وعزل صلاحيات؛ OpenAPI؛ تشغيل محلي | هذه الدفعة |
| 2 — هوية وإدارة | بريد/استرجاع، MFA، فرق، تحقق شركات، moderation، PostgreSQL | إساءة تسجيل ودعوات وIDOR وحذف/تصدير ونسخ احتياطي | 2–3 أسابيع |
| 3 — CV وAI | رفع معزول وفحص، مهام، مزود AI، مطابقة متعددة اللغات | fixtures آمنة، مقاومة prompt injection، تقييم لغوي وتكلفة | 2–3 أسابيع |
| 4 — Android | Compose، ar/en/fr وRTL، بحث وتقديم ورسائل وFCM | APK داخلي + جهاز حقيقي، offline، accessibility، permissions | 3–4 أسابيع |
| 5 — واجهة الشركات | لوحة حقيقية مرتبطة بالـAPI والفرق | end-to-end من نشر وظيفة إلى مقابلة | 2–3 أسابيع |
| 6 — beta وإنتاج | staging، مراقبة، load، pentest، سياسة خصوصية، موافقة إطلاق | صفر ثغرات حرجة/عالية مفتوحة؛ استعادة ناجحة؛ موافقة المالك | 1–2 أسبوع |

تتداخل بعض الأعمال لدى توفر فريق؛ التقديرات لا تُجمع كوعد ثابت. MVP العام لا يُعد مكتملاً بمجرد انتهاء المرحلة الأولى.

## Backlog قابل للتحويل إلى GitHub Issues

1. P0 / AUTH: تحقق البريد واسترجاع كلمة المرور وMFA. قبول: tokens مجزأة أحادية الاستخدام، rate limits مشتركة، لا enumeration تفصيلي.
2. P0 / DB: PostgreSQL ومهاجرات. قبول: تشغيل اختبارات العزل والتزامن والاستعادة على قاعدة فعلية.
3. P0 / ORG: عضويات ودعوات والتحقق والمراجعة. قبول: عضو شركة A لا يعدّل B، ومنع النشر العام قبل التحقق.
4. P0 / PRIVACY: تصدير وحذف وموافقات. قبول: لا ملفات يتيمة ولا استعادة حساب محذوف من backup دون إعادة tombstone.
5. P1 / CV: رفع PDF/DOCX مع quarantine. قبول: رفض ملف مزيف وضغط متفجر وروابط خارجية؛ time/memory limits.
6. P1 / AI: adapter وevaluation corpus. قبول: schema validation، timeout/fallback، budget cap، بيانات لا تتضمن سمات حساسة غير لازمة.
7. P1 / PUSH: outbox + FCM + device tokens. قبول: retry/expiry/revocation وdead letters بلا تسريب محتوى.
8. P1 / ANDROID: تطبيق متصل بالـAPI. قبول: لا شاشة وهمية؛ الرحلة الكاملة باللغات الثلاث؛ screenshots وتقارير build/tests.
9. P1 / WEB: لوحة شركات متصلة. قبول: جلسات آمنة وCSRF عند cookies، XSS output escaping، empty/error/loading states.
10. P0 / RELEASE: TLS، edge limits، threat review، load/restore، تراخيص/SBOM، موافقة الإنتاج.

## استراتيجية الاختبار

Unit: التطبيع والاستخراج والحساب والحالات. Integration: كل مورد بصاحب حق وآخر بلا حق، جلسة منتهية، duplicate، rollback، pagination. Contract: OpenAPI وعميل Android. E2E: شركة تنشر ومرشح يتقدم وشركة تتواصل وpush يصل. Security: IDOR وSQLi وXSS وupload abuse وSSRF وprompt injection وbrute force. Resilience: FCM/AI timeout وإعادة التشغيل وqueue replay واستعادة backup. Accessibility: TalkBack وRTL وتكبير الخط. لا تُعد نتائج الاختبارات المزيفة بديلاً عن جهاز Android أو خدمة حقيقية في staging.
