import base64
import io
import json
import re
import sys
from html import escape
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, KeepTogether
from PIL import Image as PILImage

data=json.load(sys.stdin)
pdfmetrics.registerFont(TTFont('AlunoTexto',r'C:\Windows\Fonts\arial.ttf'))
pdfmetrics.registerFont(TTFont('AlunoNegrito',r'C:\Windows\Fonts\arialbd.ttf'))
styles={
 'title':ParagraphStyle('title',fontName='AlunoNegrito',fontSize=20,leading=26,textColor=colors.HexColor('#194c59'),spaceAfter=12),
 'intro':ParagraphStyle('intro',fontName='AlunoTexto',fontSize=10,leading=15,textColor=colors.HexColor('#526d75'),spaceAfter=14),
 'cat':ParagraphStyle('cat',fontName='AlunoNegrito',fontSize=9,leading=14,textColor=colors.HexColor('#d36e12'),spaceBefore=13),
 'heading':ParagraphStyle('heading',fontName='AlunoNegrito',fontSize=14,leading=19,textColor=colors.HexColor('#194c59'),spaceAfter=8),
 'body':ParagraphStyle('body',fontName='AlunoTexto',fontSize=10.5,leading=16,textColor=colors.HexColor('#233b43'),spaceAfter=8,splitLongWords=1),
}
output=io.BytesIO()
doc=SimpleDocTemplate(output,pagesize=A4,rightMargin=48,leftMargin=48,topMargin=52,bottomMargin=48,title='Monalisa Gestores - Conteúdos para alunos')
flow=[Paragraph('Monalisa Gestores · Conteúdos para alunos',styles['title']),Paragraph('Este material reúne somente os artigos vinculados a aulas e liberados para alunos. Outros conteúdos serão incluídos quando forem liberados.',styles['intro'])]
for topic in data['topics']:
    flow.append(KeepTogether([Paragraph(escape(topic['category']),styles['cat']),Paragraph(escape(topic['title']),styles['heading'])]))
    parts=re.split(r'(\[\[(?:imagem:\d+|artigo:(?:m-\d+|[0-9a-f-]{36}))\]\])',topic['body'],flags=re.I)
    for part in parts:
        im=re.fullmatch(r'\[\[imagem:(\d+)\]\]',part,re.I)
        link=re.fullmatch(r'\[\[artigo:(m-\d+|[0-9a-f-]{36})\]\]',part,re.I)
        if im:
            index=int(im.group(1))-1
            if index<0 or index>=len(topic['images']): raise ValueError('Imagem referenciada não encontrada')
            raw=base64.b64decode(topic['images'][index],validate=True)
            image=PILImage.open(io.BytesIO(raw));image.load()
            if image.width*image.height>30000000: raise ValueError('Imagem excede o limite')
            if image.mode not in ('RGB','RGBA'):image=image.convert('RGBA' if 'transparency' in image.info else 'RGB')
            normalized=io.BytesIO();image.save(normalized,format='PNG');normalized.seek(0)
            width=min(doc.width,image.width*0.75);height=image.height*width/image.width
            if height>600:width*=600/height;height=600
            flow.extend([Image(normalized,width=width,height=height),Spacer(1,10)])
        elif link:
            label=data['allowed_titles'].get(link.group(1),'Artigo indisponível')
            flow.append(Paragraph(escape(label),styles['body']))
        elif part:
            for line in part.splitlines():
                flow.append(Paragraph(escape(line) if line else '&#160;',styles['body']))
if not data['topics']:flow.append(Paragraph('Nenhum artigo foi liberado para alunos ainda.',styles['body']))
def footer(canvas,document):
    canvas.setFont('AlunoTexto',8);canvas.setFillColor(colors.HexColor('#748b92'))
    canvas.drawRightString(A4[0]-48,25,str(document.page))
doc.build(flow,onFirstPage=footer,onLaterPages=footer)
sys.stdout.buffer.write(output.getvalue())
