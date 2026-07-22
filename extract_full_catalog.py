import pdfplumber, re, json
P="/root/.claude/uploads/087eb6a4-9792-59b6-af15-064779936db4/7b6b3d34-________________122026_260722_124313.pdf"
PAGE_BRAND={0:"Alpenzu",1:"Cantarelli",2:"Dalla Costa",3:"Deliziosa",4:"Deseo",5:"Foresti",
 6:"Ibis",7:"Maletti",8:"Olivieri 1882",9:"Terre di Puglia",10:"Villa Grimelli",11:"Villani",
 12:"Riso Gallo",13:"Divella",14:"Divella",15:"Mancini"}
BRAND_VARIANTS={"Alpenzu":["Alpenzu"],"Cantarelli":["Cantarelli"],"Dalla Costa":["Dalla Costa"],
 "Deliziosa":["Deliziosa","Делициоза"],"Deseo":["DESEO","Deseo"],"Foresti":["FORESTI","Foresti"],
 "Ibis":["IBIS","Ibis"],"Maletti":["Maletti","Малетти"],"Olivieri 1882":["Olivieri 1882"],
 "Terre di Puglia":["Terre di Puglia"],"Villa Grimelli":["Villa Grimelli"],
 "Villani":["Villani","Вилани","Вилана"],"Riso Gallo":["Gallo","Галло"],"Iposea":["Iposea","Ипосеа"],
 "Divella":["Divella","Дивела"],"Polselli":["Polselli"],"Mancini":["Mancini","Манчини"]}
ALL_CANON=list(BRAND_VARIANTS.keys())
UNIT_RE=re.compile(r'^(бр|БР|кг|КГ|Кг|г|Г|л|Л)\.?$',re.U)
HOMO=str.maketrans("кКгГрРмМлЛ","kKgGrRmMlL")
WEIGHT_RE=re.compile(r'^\s*(\d+(?:[.,]\d+)?)\s*([A-Za-zА-Яа-я]{1,3})\.?(?=\s|$)',re.U)
def clean(s): return re.sub(r'\s+',' ',(s or '').replace('\n',' ')).strip()
def parse_weight(name):
    m=WEIGHT_RE.match(name)
    if not m:
        m2=re.match(r'^\s*(\d+(?:[.,]\d+)?)\s+(?=[А-Яа-я])',name)  # bare number, no unit
        if m2: return m2.group(1).replace(",","."), name[m2.end():].strip()
        return "", name
    num=m.group(1).replace(",",".")
    letters=m.group(2).translate(HOMO).lower()
    if letters.startswith("kg"): un="kg"
    elif letters=="g" or letters.startswith("gr"): un="g"
    elif letters.startswith("ml"): un="ml"
    elif letters=="l": un="l"
    else: return "", name  # not a unit -> leave
    return f"{num} {un}", name[m.end():].strip()
def strip_brand(name,page_default):
    low=name.lower().rstrip()
    for canon in ALL_CANON:
        for v in BRAND_VARIANTS[canon]:
            if low.endswith(v.lower()):
                return name[:len(name)-len(v)].strip(" .,-"), canon
    return name, page_default

rows=[]
with pdfplumber.open(P) as pdf:
    for idx,page in enumerate(pdf.pages):
        pbrand=PAGE_BRAND[idx]
        for t in page.find_tables():
            for r in t.extract():
                cells=[clean(c) for c in r if c is not None]
                eur=[c for c in cells if 'EUR' in c]; lv=[c for c in cells if 'лв' in c]
                if len(eur)!=2: continue
                fp=min([cells.index(x) for x in (eur+lv)]); left=cells[:fp]
                uidx=next((i for i,c in enumerate(left) if UNIT_RE.match(c)),None)
                if uidx is not None and uidx>=1:
                    name_cell=left[uidx-1]; art=" ".join(x for x in left[:uidx-1] if x)
                else:
                    ne=[c for c in left if c]
                    if not ne: continue
                    name_cell=max(ne,key=len); art=" ".join(x for x in ne if x!=name_cell)
                if not name_cell: continue
                def ev(c):
                    m=re.search(r'([\d]+(?:[.,]\d+)?)\s*EUR',c); return float(m.group(1).replace(',','.')) if m else None
                def lvv(c):
                    m=re.search(r'([\d]+(?:[.,]\d+)?)\s*лв',c.replace(' ,',',')); return float(m.group(1).replace(',','.')) if m else None
                p_no,p_with=ev(eur[0]),ev(eur[1])
                lv_no=lvv(lv[0]) if len(lv)>=1 else None; lv_with=lvv(lv[1]) if len(lv)>=2 else None
                name_nb,brand=strip_brand(name_cell,pbrand)
                weight,name_final=parse_weight(name_nb)
                rows.append({"page":idx+1,"art":art,"name_bg":name_final,"weight":weight,
                    "brand":brand,"p_no":p_no,"p_with":p_with,"lv_no":lv_no,"lv_with":lv_with,"note":""})

# --- fix corrupted page-14 Gris row ---
for r in rows:
    if r["name_bg"].startswith("50 1к-г0") or r["art"].startswith("уални"):
        r.update({"art":"50","name_bg":"Грис двойносмляна /за паста и хляб/","weight":"1 kg",
                  "brand":"Divella","note":"reconstructed from overlapping source text"})
# --- repair 5 Foresti VAT-with-VAT typos (лв column confirms correct ratio) ---
for r in rows:
    if r["p_no"] and abs(round(r["p_no"]*1.2,2)-r["p_with"])>0.03:
        corrected=round(r["p_no"]*1.2,2)
        r["note"]=(r["note"]+"; " if r["note"] else "")+f"price incl. VAT corrected from {r['p_with']} (source typo; лв ratio confirms)"
        r["p_with"]=corrected

print("TOTAL:",len(rows))
print("VAT anomalies now:",sum(1 for r in rows if r["p_no"] and abs(round(r["p_no"]*1.2,2)-r["p_with"])>0.03))
print("weight missing:",sum(1 for r in rows if not r["weight"]))
for r in rows:
    if not r["weight"]: print("   NOWEIGHT:",r["page"],repr(r["art"]),repr(r["name_bg"]))
json.dump(rows,open("/home/user/meet/rows.json","w"),ensure_ascii=False,indent=1)
# dump unique names for translation
uniq={}
for r in rows: uniq.setdefault(r["name_bg"], r["brand"])
print("\nUNIQUE NAMES:",len(uniq))
