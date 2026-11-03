import type { Locale } from "./config";

const uk = {
  eyebrow: "Hi-fi для вашого простору",
  heroLines: ["Підсилювачі.", "Акустика.", "Ваша музика."],
  intro: "Невеликий каталог техніки з характером. Оберіть готовий апарат або обговоріть систему, яку хочеться слухати щодня.",
  catalog: "Дивитися каталог", talk: "Обговорити систему",
  demoImage: "Ламповий підсилювач · демоілюстрація", materials: "Скло. Метал. Дерево.",
  selection: "У каталозі зараз",
  selectionText: "Апарати, які є в наявності. Деталі, характеристики та ціна — у картці кожного.",
  all: "Увесь каталог", conversation: ["Спочатку —", "розмова."],
  conversationText: "Кімната, улюблені записи, ваша нинішня система. Розкажіть, з чого починаєте, — підберемо наступний крок разом.",
  conversationLink: "Залишити запит майстру",
  consultationTopics: ["Підібрати компоненти", "Обговорити виготовлення", "Запитати про сервіс"],
  footer: "Для тих, хто слухає уважно.",
  category: {
    eyebrow: "Каталог / Розділи", main: "Основні дані", mainHint: "Назва, адреса та опис на вітрині.",
    structure: "Структура каталогу", structureHint: "Розташування розділу в каталозі.",
    saved: "Усі зміни збережено", unsaved: "Є незбережені зміни", preview: "Відкрити на вітрині",
    addSpec: "Додати характеристику", specsHint: "Визначають поля товарів і доступні фільтри.", close: "Закрити форму",
  },
};
type Copy = typeof uk;
const en: Copy = {
  eyebrow: "Hi-fi for your space", heroLines: ["Amplifiers.", "Speakers.", "Your music."],
  intro: "A small catalog of equipment with character. Choose a ready-made piece or talk about a system you will want to listen to every day.",
  catalog: "Explore the catalog", talk: "Talk about your system", demoImage: "Tube amplifier · demo illustration", materials: "Glass. Metal. Wood.",
  selection: "In the catalog now", selectionText: "Equipment currently in stock. Details, specifications and prices are on each product page.",
  all: "Full catalog", conversation: ["First,", "a conversation."],
  conversationText: "Your room, favorite records and current setup. Tell us where you are starting — we will work out the next step together.",
  conversationLink: "Send a request to the maker", consultationTopics: ["Choose components", "Discuss a custom build", "Ask about servicing"],
  footer: "For those who listen closely.",
  category: {
    eyebrow: "Catalog / Categories", main: "Basic information", mainHint: "Name, address and description on the storefront.",
    structure: "Catalog structure", structureHint: "Where this category belongs in the catalog.",
    saved: "All changes saved", unsaved: "Unsaved changes", preview: "View on storefront",
    addSpec: "Add specification", specsHint: "Define product fields and available filters.", close: "Close form",
  },
};
export const workshopCopy: Record<Locale, Copy> = { uk, en };
