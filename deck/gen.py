# -*- coding: utf-8 -*-
import os, json

KUFI = "'Noto Kufi Arabic','Geeza Pro',Tahoma,sans-serif"
BODY = "'IBM Plex Sans Arabic','Geeza Pro',Tahoma,sans-serif"
MONO = "'IBM Plex Mono',ui-monospace,monospace"

GROUND = "#0B0A09"
TEXT   = "#F7F3EC"
MUTED  = "#7C766D"
ACCENT = "#FF5C1A"
LINE   = "#241F1B"

HEAD = """<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans+Arabic:wght@300;400;600&family=Noto+Kufi+Arabic:wght@400;700;900&display=swap">
  <style>
    body { margin: 0; background: %s; }
    a { color: %s; } a:hover { color: #FF8352; }
  </style>
</helmet>
""" % (GROUND, ACCENT)

TAIL = """</x-dc>
</body>
</html>
"""

def frame(num, caption, inner, pad="88px 104px"):
    return HEAD + (
'<div dir="rtl" style="width: 1600px; height: 900px; box-sizing: border-box; background: %s; '
'color: %s; font-family: %s; padding: %s; display: flex; flex-direction: column; '
'justify-content: space-between; overflow: hidden; position: relative;">\n'
'  <div style="display: flex; justify-content: space-between; align-items: center;">\n'
'    <div style="font-family: %s; font-size: 15px; letter-spacing: 0.18em; color: %s;">%s</div>\n'
'    <div style="font-family: %s; font-size: 15px; color: %s;">%s</div>\n'
'  </div>\n'
'%s\n'
'  <div style="display: flex; justify-content: space-between; align-items: flex-end; '
'border-top: 1px solid %s; padding-top: 22px;">\n'
'    <div style="font-family: %s; font-size: 16px; font-weight: 700; letter-spacing: 0.02em; color: %s;">نسيج</div>\n'
'    <div style="font-family: %s; font-size: 14px; letter-spacing: 0.2em; color: %s;">NASIJ</div>\n'
'  </div>\n'
'</div>\n') % (GROUND, TEXT, BODY, pad, MONO, MUTED, caption, MONO, MUTED, num, inner, LINE, KUFI, MUTED, MONO, LINE) + TAIL

def h1(t, size=104, color=None, lh=1.22):
    return ('  <div style="font-family: %s; font-weight: 700; font-size: %dpx; line-height: %s; '
            'color: %s; letter-spacing: -0.01em; text-wrap: balance;">%s</div>' % (KUFI, size, lh, color or TEXT, t))

def p(t, size=30, color=None, mt=28, w="1120px"):
    return ('  <div style="font-size: %dpx; line-height: 1.75; color: %s; margin-top: %dpx; max-width: %s; font-weight: 300;">%s</div>'
            % (size, color or MUTED, mt, w, t))

def bar(w="220px", mb=44, h="10px"):
    return '  <div style="width: %s; height: %s; background: %s; margin-bottom: %dpx;"></div>' % (w, h, ACCENT, mb)

S = {}

# ---------- 01 cover ----------
S["Main"] = HEAD + (
'<div dir="rtl" style="width: 1600px; height: 900px; box-sizing: border-box; background: %s; color: %s; '
'font-family: %s; padding: 96px 104px; display: flex; flex-direction: column; justify-content: space-between; overflow: hidden;">\n'
'  <div style="display: flex; justify-content: flex-start;">\n'
'    <div style="width: 340px; height: 12px; background: %s;"></div>\n'
'  </div>\n'
'  <div>\n'
'    <div style="font-family: %s; font-weight: 900; font-size: 236px; line-height: 0.94; letter-spacing: -0.02em; color: %s;">نسيج</div>\n'
'    <div style="font-family: %s; font-size: 22px; letter-spacing: 0.42em; color: %s; margin-top: 26px;">N A S I J</div>\n'
'    <div style="font-size: 40px; font-weight: 300; color: %s; margin-top: 52px; line-height: 1.6;">خريطة حيّة لما تستطيع المملكة صناعته <span style="color: %s; font-weight: 600;">فعلاً</span>.</div>\n'
'  </div>\n'
'  <div style="display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px solid %s; padding-top: 26px;">\n'
'    <div style="font-size: 20px; color: %s;">هاكاثون ابتكار — المسار الأول</div>\n'
'    <div style="font-family: %s; font-size: 15px; letter-spacing: 0.2em; color: %s;">01 / 12</div>\n'
'  </div>\n'
'</div>\n') % (GROUND, TEXT, BODY, ACCENT, KUFI, TEXT, MONO, ACCENT, MUTED, TEXT, LINE, MUTED, MONO, LINE) + TAIL

# ---------- 02 the question ----------
S["Question"] = frame("02 · الافتتاحية", "02",
'  <div style="margin: auto 0;">\n'
+ bar("180px", 40) + "\n"
+ h1("«هل يصنع أحدٌ في السعودية هذا؟»", 116) + "\n"
+ p("سؤال يبدو كمربع بحث.", 32, MUTED, 40) + "\n"
+ '  <div style="font-family: %s; font-weight: 700; font-size: 58px; color: %s; margin-top: 36px;">لا أحد يستطيع الإجابة عليه.</div>\n' % (KUFI, ACCENT)
+ '  </div>')

# ---------- 03 nobody can tell them apart ----------
S["Blind"] = frame("03 · لماذا يهم", "03",
'  <div style="margin: auto 0;">\n'
+ p("الصندوق يملك أكثر من <span style=\"color: %s; font-weight: 600;\">١٥٠ شركة</span>. تشتري حديداً وصمامات وكابلات وكيماويات ومعدات — كل يوم، وبكميات ضخمة. وكثير من ذلك يأتي من الخارج." % TEXT, 30, MUTED, 0, "1180px") + "\n"
+ '  <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 32px; margin-top: 52px;">\n'
'    <div style="border: 1px solid %s; border-radius: 2px; padding: 40px 36px;">\n'
'      <div style="font-family: %s; font-size: 14px; letter-spacing: 0.18em; color: %s; margin-bottom: 18px;">CASE A</div>\n'
'      <div style="font-family: %s; font-weight: 700; font-size: 40px; color: %s; line-height: 1.4;">لسبب وجيه</div>\n'
'      <div style="font-size: 26px; color: %s; margin-top: 16px; font-weight: 300;">لا أحد هنا يصنعه.</div>\n'
'    </div>\n'
'    <div style="border: 1px solid %s; border-radius: 2px; padding: 40px 36px; background: rgba(255,92,26,0.06);">\n'
'      <div style="font-family: %s; font-size: 14px; letter-spacing: 0.18em; color: %s; margin-bottom: 18px;">CASE B</div>\n'
'      <div style="font-family: %s; font-weight: 700; font-size: 40px; color: %s; line-height: 1.4;">لسبب مؤسف</div>\n'
'      <div style="font-size: 26px; color: %s; margin-top: 16px; font-weight: 300;">هناك من يصنعه على بُعد ساعتين، والمشتري لم يكن يعلم.</div>\n'
'    </div>\n'
'  </div>\n' % (LINE, MONO, MUTED, KUFI, TEXT, MUTED, ACCENT, MONO, ACCENT, KUFI, ACCENT, TEXT)
+ '  <div style="font-family: %s; font-weight: 700; font-size: 56px; color: %s; margin-top: 54px;">ولا أحد يستطيع التمييز بينهما.</div>\n' % (KUFI, TEXT)
+ '  </div>')

# ---------- 04 who makes what ----------
S["WhoMakes"] = frame("04 · المشكلة، النصف الأول", "04",
'  <div style="margin: auto 0;">\n'
+ h1("لا نعرف مَن يستطيع صناعة ماذا", 84) + "\n"
+ p("الطريقة الوحيدة لمعرفة ما يستطيع مصنع سعودي إنتاجه هي أن يخبرهم المصنع بنفسه. لذلك فكل دليل موردين في العالم هو قائمة بالشركات التي رفعت يدها.", 28, MUTED, 30, "1080px") + "\n"
+ '  <div style="display: flex; gap: 0; margin-top: 46px; border-right: 4px solid %s; padding-right: 34px;">\n'
'    <div>\n'
'      <div style="font-size: 30px; color: %s; line-height: 1.7; font-weight: 300; max-width: 1080px;">تخيّل دليل هاتف لا تُدرَج فيه إلا إذا أرسلت نموذجاً بالبريد. <span style="color: %s; font-weight: 600;">فمن الذي يرسل النماذج؟</span> الشركات الكبيرة التي لديها فرق مبيعات وظيفتها إرسال النماذج.</div>\n'
'      <div style="font-size: 26px; color: %s; line-height: 1.7; margin-top: 20px; font-weight: 300; max-width: 1080px;">أما الورشة في الخرج التي تُصنّع قطعاً دقيقة منذ عشرين عاماً؟ ليست في الدليل. ولن تكون.</div>\n'
'    </div>\n'
'  </div>\n' % (ACCENT, TEXT, ACCENT, MUTED)
+ '  <div style="font-family: %s; font-weight: 700; font-size: 46px; color: %s; margin-top: 44px; line-height: 1.4;">وهي بالضبط المورّد الذي احتجته.</div>\n' % (KUFI, TEXT)
+ '  </div>')

# ---------- 05 what we buy ----------
S["WhatWeBuy"] = frame("05 · المشكلة، النصف الثاني", "05",
'  <div style="margin: auto 0;">\n'
+ h1("لا نعرف ماذا نشتري", 84) + "\n"
+ p("أكثر من ١٥٠ شركة. وأكثر من ١٥٠ نظام مشتريات. ولغتان. ونصوص حرة.", 28, MUTED, 26) + "\n"
+ '  <div dir="ltr" style="display: flex; flex-direction: column; gap: 14px; margin-top: 42px; max-width: 900px;">\n'
'    <div style="font-family: %s; font-size: 30px; color: %s; background: #141210; border-right: 4px solid %s; padding: 20px 26px;" dir="rtl">صمام كروي ٢ بوصة</div>\n'
'    <div style="font-family: %s; font-size: 30px; color: %s; background: #141210; border-right: 4px solid %s; padding: 20px 26px;">BALL VLV 2IN SS</div>\n'
'    <div style="font-family: %s; font-size: 30px; color: %s; background: #141210; border-right: 4px solid %s; padding: 20px 26px;">Valve, ball, stainless, 2 inch</div>\n'
'  </div>\n' % (BODY, TEXT, ACCENT, MONO, TEXT, ACCENT, MONO, TEXT, ACCENT)
+ '  <div style="font-family: %s; font-weight: 700; font-size: 46px; color: %s; margin-top: 44px; line-height: 1.45;">الشيء ذاته. وثلاث سلاسل يراها الحاسب <span style="color: %s;">بلا أي علاقة ببعضها.</span></div>\n' % (KUFI, TEXT, ACCENT)
+ '  </div>')

# ---------- 06 what changed ----------
items = [("سجل المنافسات العام","فاز بعقد حكومي"),("كتالوج عام · ٣,١٥٣ مصنعاً","سجّل منتجاته لدى الوزارة"),("منشورة","الشهادات"),("منشور","ما تستورده المملكة حسب المنتج")]
grid = ""
for val, key in items:
    grid += ('    <div style="border-top: 1px solid %s; padding-top: 22px;">\n'
             '      <div style="font-size: 22px; color: %s; font-weight: 300;">%s</div>\n'
             '      <div style="font-family: %s; font-weight: 700; font-size: 27px; color: %s; margin-top: 10px; line-height: 1.4;">%s</div>\n'
             '    </div>\n') % (LINE, MUTED, key, KUFI, TEXT, val)
S["WhatChanged"] = frame("06 · ما الذي تغيّر", "06",
'  <div style="margin: auto 0;">\n'
+ bar("140px", 34) + "\n"
+ h1("كل الأدلة منشورة أصلاً.<br>لكنها <span style=\"color: %s;\">متناثرة</span>." % ACCENT, 88) + "\n"
+ '  <div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 30px; margin-top: 56px;">\n' + grid + '  </div>\n'
+ '  <div style="font-size: 32px; color: %s; margin-top: 48px; font-weight: 300;">باحث جيد يستطيع إنجاز <span style="color: %s; font-weight: 600;">مصنع واحد</span> في بعد ظهر يوم.</div>\n' % (MUTED, TEXT)
+ '  </div>')

# ---------- 07 the wall ----------
S["TheWall"] = frame("07 · فلماذا لم يفعلها أحد؟", "07",
'  <div style="margin: auto 0;">\n'
+ '  <div style="display: flex; align-items: flex-end; gap: 56px; flex-wrap: wrap;">\n'
'    <div>\n'
'      <div style="font-family: %s; font-size: 15px; letter-spacing: 0.16em; color: %s;">المصانع</div>\n'
'      <div style="font-family: %s; font-weight: 900; font-size: 118px; color: %s; line-height: 1;">٣,١٥٣</div>\n'
'    </div>\n'
'    <div style="font-size: 56px; color: %s; padding-bottom: 18px;">←</div>\n'
'    <div>\n'
'      <div style="font-family: %s; font-size: 15px; letter-spacing: 0.16em; color: %s;">سنة عمل لشخص واحد</div>\n'
'      <div style="font-family: %s; font-weight: 900; font-size: 118px; color: %s; line-height: 1;">١٣</div>\n'
'    </div>\n'
'    <div style="font-size: 56px; color: %s; padding-bottom: 18px;">←</div>\n'
'    <div>\n'
'      <div style="font-family: %s; font-size: 15px; letter-spacing: 0.16em; color: %s;">شهراً بعشرة باحثين</div>\n'
'      <div style="font-family: %s; font-weight: 900; font-size: 118px; color: %s; line-height: 1;">١٥</div>\n'
'    </div>\n'
'  </div>\n' % (MONO, MUTED, KUFI, TEXT, ACCENT, MONO, MUTED, KUFI, TEXT, ACCENT, MONO, MUTED, KUFI, ACCENT)
+ '  <div style="font-family: %s; font-weight: 700; font-size: 60px; color: %s; margin-top: 72px; line-height: 1.35; max-width: 1280px;">وفي الشهر الخامس عشر، يكون الشهر الأول <span style="color: %s;">قد صار خطأً.</span></div>\n' % (KUFI, TEXT, ACCENT)
+ '  </div>')

# ---------- 08 the team ----------
roles = [("المترجم","يستخرج ما هو الشيء فعلاً، ويمنحه رمزاً دولياً — فيصبح بندٌ عربي وبندٌ إنجليزي شيئاً واحداً."),
         ("المحقّق","يبحث عن المصانع القادرة: المواقع، السجل التجاري، العقود المرساة، الشهادات. ولا يقول شيئاً دون مصدره."),
         ("المدقّق","مهمته أن يثبت خطأ المحقّق. مصنع حقيقي أم تاجر يعيد البيع؟ اثنان من الأربعة لا ينجوان."),
         ("الاستراتيجي","حين تكون الإجابة «لا أحد»: كم نستورد، ومَن يستطيع التحوّل لصناعته.")]
cards = ""
for i,(n,d) in enumerate(roles):
    cards += ('    <div style="border-top: 3px solid %s; padding-top: 24px;">\n'
              '      <div style="font-family: %s; font-size: 14px; letter-spacing: 0.16em; color: %s;">0%d</div>\n'
              '      <div style="font-family: %s; font-weight: 700; font-size: 40px; color: %s; margin-top: 12px;">%s</div>\n'
              '      <div style="font-size: 21px; line-height: 1.75; color: %s; margin-top: 16px; font-weight: 300;">%s</div>\n'
              '    </div>\n') % (ACCENT if i in (0,3) else LINE, MONO, MUTED, i+1, KUFI, TEXT, n, MUTED, d)
S["TheTeam"] = frame("08 · إذن كيف نحلّها؟", "08",
'  <div style="margin: auto 0;">\n'
+ h1("ببساطة. <span style=\"color: %s;\">نوظّف فريقاً.</span>" % ACCENT, 88) + "\n"
+ p("أربعة أشخاص. وهذا ما يفعله كل واحد حين يصل بند شراء واحد إلى المكتب.", 26, MUTED, 22) + "\n"
+ '  <div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 34px; margin-top: 52px;">\n' + cards + '  </div>\n'
+ '  </div>')

# ---------- 09 the reveal ----------
S["TheReveal"] = HEAD + (
'<div dir="rtl" style="width: 1600px; height: 900px; box-sizing: border-box; background: %s; color: %s; '
'font-family: %s; padding: 88px 104px; display: flex; flex-direction: column; justify-content: center; overflow: hidden;">\n'
'  <div style="font-size: 30px; color: %s; font-weight: 300;">لقد وظّفت للتو أربعة أشخاص. ولتغطية المملكة تحتاج آلافاً — وسيظلون متأخرين ١٥ شهراً.</div>\n'
'  <div style="width: 100%%; height: 1px; background: %s; margin: 46px 0;"></div>\n'
'  <div style="font-family: %s; font-weight: 900; font-size: 148px; line-height: 1.06; color: %s; letter-spacing: -0.02em;">لكن خمّن ماذا.</div>\n'
'  <div style="font-family: %s; font-weight: 900; font-size: 148px; line-height: 1.06; color: %s; letter-spacing: -0.02em;">إنهم ليسوا بشراً.</div>\n'
'  <div style="display: flex; gap: 18px; margin-top: 62px; flex-wrap: wrap;">\n'
'    <div style="font-family: %s; font-size: 22px; color: %s; background: rgba(255,92,26,0.10); border: 1px solid %s; padding: 14px 24px;">وكلاء ذكاء اصطناعي</div>\n'
'    <div style="font-family: %s; font-size: 22px; color: %s; border: 1px solid %s; padding: 14px 24px;">آلاف بالتوازي</div>\n'
'    <div style="font-family: %s; font-size: 22px; color: %s; border: 1px solid %s; padding: 14px 24px;">٢٤ ساعة</div>\n'
'    <div style="font-family: %s; font-size: 22px; color: %s; border: 1px solid %s; padding: 14px 24px;">دقيقتان لكل مصنع</div>\n'
'  </div>\n'
'</div>\n') % (GROUND, TEXT, BODY, MUTED, LINE, KUFI, TEXT, KUFI, ACCENT,
               BODY, ACCENT, ACCENT, BODY, MUTED, LINE, BODY, MUTED, LINE, BODY, MUTED, LINE) + TAIL

# ---------- 10 the map / flow ----------
def node(name, sub="وكيل ذكاء اصطناعي", accent=False):
    bc = ACCENT if accent else LINE
    return ('    <div style="flex: 1 1 0; border: 1px solid %s; background: %s; padding: 22px 16px; text-align: center;">\n'
            '      <div style="font-family: %s; font-weight: 700; font-size: 26px; color: %s;">%s</div>\n'
            '      <div style="font-family: %s; font-size: 13px; color: %s; margin-top: 8px; letter-spacing: 0.04em;">%s</div>\n'
            '    </div>\n') % (bc, "rgba(255,92,26,0.07)" if accent else "#121010", KUFI, TEXT, name, BODY, ACCENT if accent else MUTED, sub)

def arrow():
    return ('    <div style="flex: 0 0 42px; display: flex; align-items: center; justify-content: center; color: %s; font-size: 30px;">←</div>\n') % ACCENT

outs = [("مَن يستطيع صناعته","قائمة مصانع، مع دليل كل واحد"),
        ("ما لا يصنعه أحد","سجل الفجوات، مرتّب بقيمة الاستيراد"),
        ("النسبة المئوية","كم يمكن شراؤه محلياً اليوم")]
og = ""
for t,d in outs:
    og += ('    <div style="border-top: 3px solid %s; padding-top: 18px;">\n'
           '      <div style="font-family: %s; font-weight: 700; font-size: 28px; color: %s;">%s</div>\n'
           '      <div style="font-size: 19px; color: %s; margin-top: 8px; font-weight: 300;">%s</div>\n'
           '    </div>\n') % (ACCENT, KUFI, TEXT, t, MUTED, d)

S["TheMap"] = frame("10 · ما الذي يبنونه", "10",
'  <div style="margin: auto 0;">\n'
+ h1("ليست إجابات. بل <span style=\"color: %s;\">خريطة</span>." % ACCENT, 76) + "\n"
+ '  <div style="display: flex; align-items: stretch; margin-top: 44px; gap: 0;">\n'
+ ('    <div style="flex: 0 0 190px; border: 1px dashed %s; padding: 22px 14px; text-align: center;">\n'
   '      <div style="font-family: %s; font-weight: 700; font-size: 24px; color: %s;">بند شراء</div>\n'
   '      <div style="font-family: %s; font-size: 13px; color: %s; margin-top: 8px;">عربي أو إنجليزي</div>\n'
   '    </div>\n') % (LINE, KUFI, MUTED, BODY, MUTED)
+ arrow() + node("المترجم") + arrow() + node("المحقّق") + arrow() + node("المدقّق") + arrow()
+ ('    <div style="flex: 0 0 210px; background: %s; padding: 26px 14px; text-align: center; display: flex; flex-direction: column; justify-content: center;">\n'
   '      <div style="font-family: %s; font-weight: 900; font-size: 30px; color: #0B0A09;">الخريطة</div>\n'
   '      <div style="font-family: %s; font-size: 13px; color: rgba(11,10,9,0.72); margin-top: 6px;">سجلّ واحد · يتراكم</div>\n'
   '    </div>\n') % (ACCENT, KUFI, BODY)
+ '  </div>\n'
+ '  <div style="display: flex; align-items: center; gap: 14px; margin-top: 22px;">\n'
'    <div style="font-family: %s; font-size: 15px; color: %s; letter-spacing: 0.06em;">الاستراتيجي — وكيل ذكاء اصطناعي — يقرأ الخريطة ويبني الحالة الاستثمارية لكل فجوة</div>\n'
'  </div>\n' % (BODY, MUTED)
+ '  <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 34px; margin-top: 46px;">\n' + og + '  </div>\n'
+ '  </div>')

# ---------- 11 the math ----------
rows = [("الوقت","١٥ شهراً","عطلة نهاية أسبوع"),
        ("التكلفة","ملايين الريالات","≈ ٠.٣٠ دولار للمصنع · أقل من ١,٠٠٠ دولار"),
        ("الحداثة","صورة ثابتة، خاطئة عند التسليم","يُحدّث نفسه")]
tr = ""
for k,a,b in rows:
    tr += ('    <div style="display: grid; grid-template-columns: 200px 1fr 1fr; gap: 30px; align-items: center; border-top: 1px solid %s; padding: 26px 0;">\n'
           '      <div style="font-family: %s; font-weight: 700; font-size: 28px; color: %s;">%s</div>\n'
           '      <div style="font-size: 26px; color: %s; font-weight: 300;">%s</div>\n'
           '      <div style="font-size: 26px; color: %s; font-weight: 600;">%s</div>\n'
           '    </div>\n') % (LINE, KUFI, MUTED, k, MUTED, a, TEXT, b)
S["TheMath"] = frame("11 · الحساب", "11",
'  <div style="margin: auto 0;">\n'
+ '  <div style="display: grid; grid-template-columns: 200px 1fr 1fr; gap: 30px; padding-bottom: 14px;">\n'
'    <div></div>\n'
'    <div style="font-family: %s; font-size: 14px; letter-spacing: 0.16em; color: %s;">الطريقة القديمة</div>\n'
'    <div style="font-family: %s; font-size: 14px; letter-spacing: 0.16em; color: %s;">نسيج</div>\n'
'  </div>\n' % (MONO, MUTED, MONO, ACCENT)
+ tr
+ '  <div style="font-family: %s; font-weight: 700; font-size: 54px; color: %s; margin-top: 56px; line-height: 1.35;">الجزء المكلف لم يكن التفكير قط.<br><span style="color: %s;">بل عدد الأيام المطلوبة.</span></div>\n' % (KUFI, TEXT, ACCENT)
+ '  </div>')

# ---------- 12 close ----------
S["TheClose"] = HEAD + (
'<div dir="rtl" style="width: 1600px; height: 900px; box-sizing: border-box; background: %s; color: %s; '
'font-family: %s; padding: 88px 104px; display: flex; flex-direction: column; justify-content: center; overflow: hidden;">\n'
'  <div style="width: 340px; height: 12px; background: %s; margin-bottom: 56px;"></div>\n'
'  <div style="font-family: %s; font-weight: 900; font-size: 96px; line-height: 1.24; color: %s; letter-spacing: -0.015em;">مساهمة تعرف <span style="color: %s;">مَن سجّل</span>.</div>\n'
'  <div style="font-family: %s; font-weight: 900; font-size: 96px; line-height: 1.24; color: %s; letter-spacing: -0.015em;">نسيج يعرف <span style="color: %s;">ما تستطيع البلاد صناعته</span>.</div>\n'
'  <div style="font-size: 30px; color: %s; margin-top: 52px; font-weight: 300; max-width: 1180px; line-height: 1.7;">الأولى قائمة بمن رفعوا أيديهم. والثاني خريطة لما هو موجود فعلاً — بمن فيهم كل من لم يرفع يده قط.</div>\n'
'  <div style="border-top: 1px solid %s; margin-top: 64px; padding-top: 26px; display: flex; justify-content: space-between; align-items: center;">\n'
'    <div style="font-family: %s; font-weight: 700; font-size: 24px; color: %s;">نسيج — الخريطة الحية للقدرات الوطنية</div>\n'
'    <div style="font-family: %s; font-size: 15px; letter-spacing: 0.2em; color: %s;">12 / 12</div>\n'
'  </div>\n'
'</div>\n') % (GROUND, TEXT, BODY, ACCENT, KUFI, MUTED, TEXT, KUFI, TEXT, ACCENT, MUTED, LINE, KUFI, TEXT, MONO, LINE) + TAIL

for name, src in S.items():
    open(name + ".dc.html", "w", encoding="utf-8").write(src)

order = ["Main","Question","Blind","WhoMakes","WhatWeBuy","WhatChanged","TheWall","TheTeam","TheReveal","TheMap","TheMath","TheClose"]
titles = ["١ الغلاف","٢ السؤال","٣ لا أحد يميّز","٤ مَن يصنع ماذا","٥ ماذا نشتري","٦ ما الذي تغيّر","٧ جدار ١٥ شهراً","٨ نوظّف فريقاً","٩ الانكشاف","١٠ الخريطة","١١ الحساب","١٢ الختام"]
abs_ = []
for i, f in enumerate(order):
    col, row = i % 4, i // 4
    abs_.append({"file": f + ".dc.html", "title": titles[i],
                 "x": col * 1760, "y": row * 1160, "w": 1600, "h": 900})
json.dump({"artboards": abs_, "launch": {"view": "canvas"}},
          open("canvas.json", "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print("wrote", len(S), "artboards + canvas.json")
