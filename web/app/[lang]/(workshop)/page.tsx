import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRightIcon } from "@/components/icons";
import { getCategories, getProducts } from "@/lib/api";
import { categoryPath } from "@/lib/categories";
import { formatPrice } from "@/lib/format";
import { getI18n } from "@/lib/i18n/server";
import { localeHref } from "@/lib/i18n/routing";
import { workshopCopy } from "@/lib/i18n/workshop";
import { pageMetadata } from "@/lib/seo";
import { SITE_URL } from "@/lib/site";
import styles from "@/components/workshop/workshop.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const { locale, dict } = await getI18n();
  return pageMetadata({ title: dict.home.metaTitle, description: dict.home.metaDescription, path: "/", locale, absoluteTitle: true });
}

export default async function HomePage() {
  const { locale, dict } = await getI18n();
  const t = workshopCopy[locale];
  const jsonLd = {
    "@context": "https://schema.org", "@type": "WebSite", name: dict.common.brand,
    url: `${SITE_URL}${localeHref(locale, "/")}`, inLanguage: locale,
    potentialAction: { "@type": "SearchAction", target: `${SITE_URL}${localeHref(locale, "/catalog")}?q={search_term_string}`, "query-input": "required name=search_term_string" },
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <section className={styles.hero} aria-labelledby="workshop-title">
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>{t.eyebrow}</p>
          <h1 id="workshop-title">{t.heroLines.map((line) => <span key={line}>{line}</span>)}</h1>
          <p className={styles.intro}>{t.intro}</p>
          <div className={styles.heroActions}>
            <Link href={localeHref(locale, "/catalog")} className={styles.primary}>{t.catalog}<ArrowRightIcon className="h-4 w-4" /></Link>
            <Link href={localeHref(locale, "/consultation")} className={styles.textLink}>{t.talk}</Link>
          </div>
        </div>
        <figure className={styles.heroFigure}>
          <div className={styles.heroImage}>
            <Image src="/design/amplifier-study.webp" alt={t.demoImage} fill preload sizes="(min-width: 900px) 55vw, 100vw" className={styles.photograph} />
          </div>
          <figcaption><span>{t.demoImage}</span><span>{t.materials}</span></figcaption>
        </figure>
      </section>
      <Suspense fallback={<div className={styles.catalogLoading} role="status">{dict.common.loading}</div>}><CategoryIndex /></Suspense>
      <Suspense fallback={<div className={styles.productLoading} role="status">{dict.common.loading}</div>}><AvailableProducts /></Suspense>
      <section className={styles.conversation} aria-labelledby="workshop-conversation">
        <div><p className={styles.eyebrow}>{dict.header.consultation}</p><h2 id="workshop-conversation">{t.conversation.map((line) => <span key={line}>{line}</span>)}</h2></div>
        <div className={styles.conversationBody}>
          <p>{t.conversationText}</p>
          <ul>{t.consultationTopics.map((topic, index) => <li key={topic}><span>0{index + 1}</span>{topic}</li>)}</ul>
          <Link href={localeHref(locale, "/consultation")} className={styles.textLink}>{t.conversationLink}<ArrowRightIcon className="h-4 w-4" /></Link>
        </div>
      </section>
    </>
  );
}

async function CategoryIndex() {
  const { locale, dict } = await getI18n();
  const categories = await getCategories().catch(() => []);
  if (!categories.length) return null;
  return (
    <nav className={styles.categoryIndex} aria-label={dict.header.categoriesMenu}>
      {categories.map((category, index) => <Link key={category.id} href={localeHref(locale, categoryPath(category.slug))}><span>0{index + 1}</span>{category.name}<ArrowRightIcon className="h-4 w-4" /></Link>)}
    </nav>
  );
}

async function AvailableProducts() {
  const { locale, dict } = await getI18n();
  const t = workshopCopy[locale];
  const catalog = await getProducts(new URLSearchParams({ sort: "newest", pageSize: "100" })).catch(() => null);
  if (!catalog) return <p role="status" className={styles.catalogLoading}>{dict.home.unavailable}</p>;
  const items = catalog.items.filter((product) => product.inStock).slice(0, 4);
  if (!items.length) return null;
  return (
    <section className={styles.selection} aria-labelledby="workshop-selection">
      <div className={styles.sectionHeading}>
        <div><p className={styles.eyebrow}>{dict.header.catalog}</p><h2 id="workshop-selection">{t.selection}</h2><p>{t.selectionText}</p></div>
        <Link href={localeHref(locale, "/catalog")} className={styles.textLink}>{t.all}<ArrowRightIcon className="h-4 w-4" /></Link>
      </div>
      <ul className={styles.products}>
        {items.map((product) => <li key={product.id}>
          <article className={styles.product}>
            <Link href={localeHref(locale, `/products/${product.slug}`)} className={styles.productLink}>
              <div className={styles.productImage}>
                {product.imageUrl ? <Image src={product.imageUrl} alt="" fill sizes="(min-width: 900px) 25vw, 50vw" className={styles.productPhotograph} /> : null}
                {product.condition !== "New" ? <span className={styles.condition}>{dict.conditions[product.condition]}</span> : null}
              </div>
              <div className={styles.productMeta}><span>{product.brand.name}</span><span className={styles.stock}>{dict.product.inStockShort}</span></div>
              <h3>{product.name}</h3>
              <p className={styles.price}>{formatPrice(product.price, locale)}{product.oldPrice ? <del>{formatPrice(product.oldPrice, locale)}</del> : null}</p>
            </Link>
          </article>
        </li>)}
      </ul>
    </section>
  );
}
