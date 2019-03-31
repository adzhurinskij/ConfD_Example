/*
	Copyright (c) 2004-2011, The Dojo Foundation All Rights Reserved.
	Available via Academic Free License >= 2.1 OR the modified BSD license.
	see: http://dojotoolkit.org/license for details
*/

//>>built
define("dojo/uacss",["./dom-geometry","./_base/lang","./domReady","./sniff","./_base/window"],function(k,l,n,a,d){var e=d.doc.documentElement;d=a("ie");var b=a("opera"),f=Math.floor,m=a("ff"),g=!a("ie")&&a("trident"),p=k.boxModel.replace(/-/,""),b={dj_quirks:a("quirks"),dj_opera:b,dj_khtml:a("khtml"),dj_webkit:a("webkit"),dj_safari:a("safari"),dj_chrome:a("chrome"),dj_gecko:a("mozilla"),dj_ios:a("ios"),dj_android:a("android"),dj_trident:g};d&&(b.dj_ie=!0,b["dj_ie"+f(d)]=!0,b.dj_iequirks=a("quirks"));
m&&(b["dj_ff"+f(m)]=!0);g&&(b["dj_trident"+f(g)]=!0);b["dj_"+p]=!0;var c="",h;for(h in b)b[h]&&(c+=h+" ");e.className=l.trim(e.className+" "+c);n(function(){if(!k.isBodyLtr()){var a="dj_rtl dijitRtl "+c.replace(/ /g,"-rtl ");e.className=l.trim(e.className+" "+a+"dj_rtl dijitRtl "+c.replace(/ /g,"-rtl "))}});return a});
//# sourceMappingURL=uacss.js.map