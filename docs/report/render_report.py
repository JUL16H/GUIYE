"""Refresh the Word TOC and render a local PDF using isolated LibreOffice."""
from pathlib import Path
import os, subprocess, sys, time
ROOT = Path(__file__).resolve().parents[2]
lo = ROOT / 'src-tauri/target/report-renderer/usr'
sys.path[:0] = [str(lo/'lib/python3.14/site-packages'), str(lo/'lib/libreoffice/program')]
import uno
from com.sun.star.beans import PropertyValue

def prop(name, value):
    p = PropertyValue(); p.Name=name; p.Value=value
    return p

path = Path(sys.argv[1]).resolve()
out = ROOT / 'src-tauri/target/report-preview' / (path.stem+'.pdf')
env = os.environ.copy()
env['SAL_USE_VCLPLUGIN']='gen'
env['LIBLANGTAG_DATA_PATH']=str(lo/'share/liblangtag')
pipe = 'guiye_report_' + str(os.getpid())
with open(ROOT/'src-tauri/target/report-preview/uno.log','w') as log:
    process = subprocess.Popen([str(lo/'lib/libreoffice/program/soffice'),
        '-env:UserInstallation='+ (ROOT/'src-tauri/target/report-uno-profile').as_uri(),
        '--headless', '--norestore', '--nodefault',
        '--accept=pipe,name='+pipe+';urp;StarOffice.ComponentContext'], env=env, stdout=log, stderr=log)
    try:
        local = uno.getComponentContext()
        resolver = local.ServiceManager.createInstanceWithContext('com.sun.star.bridge.UnoUrlResolver',local)
        for attempt in range(100):
            try:
                ctx = resolver.resolve('uno:pipe,name='+pipe+';urp;StarOffice.ComponentContext')
                break
            except Exception:
                if attempt == 99: raise
                time.sleep(.1)
        desktop = ctx.ServiceManager.createInstanceWithContext('com.sun.star.frame.Desktop',ctx)
        doc = desktop.loadComponentFromURL(path.as_uri(), '_blank', 0, (prop('Hidden',True),prop('UpdateDocMode',3)))
        if doc is None: raise RuntimeError('Word document did not load')
        for name in ['Contents 1','Contents 2']:
            styles = doc.StyleFamilies.getByName('ParagraphStyles')
            if styles.hasByName(name):
                st=styles.getByName(name);st.CharHeight=10;st.CharHeightAsian=10
                st.ParaTopMargin=0;st.ParaBottomMargin=80
        indexes = doc.getDocumentIndexes()
        for i in range(indexes.Count):indexes.getByIndex(i).update()
        doc.calculateAll() if hasattr(doc,'calculateAll') else doc.refresh()
        for i in range(indexes.Count):indexes.getByIndex(i).update()
        doc.storeAsURL(path.as_uri(),(prop('FilterName','Office Open XML Text'),prop('Overwrite',True)))
        doc.storeToURL(out.as_uri(),(prop('FilterName','writer_pdf_Export'),prop('Overwrite',True)))
        print(f'Updated {indexes.Count} TOC; PDF: {out}')
        doc.close(True)
        desktop.terminate()
    finally:
        try:process.wait(timeout=10)
        except subprocess.TimeoutExpired:process.terminate()
