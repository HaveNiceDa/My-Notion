import { Linking } from "react-native";
import { ScrollView, Text, View, useTheme } from "tamagui";
import twBase from "twrnc";

const tw = twBase as any;

type MarkdownRendererProps = {
  content: string;
  compact?: boolean;
};

type Block =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "quote"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "code"; language?: string; text: string }
  | { type: "divider" }
  | { type: "table"; rows: string[][] };

type InlinePart =
  | { type: "text"; text: string }
  | { type: "bold"; text: string }
  | { type: "code"; text: string }
  | { type: "link"; text: string; href: string };

const codeFenceRegex = /^```(\w+)?\s*$/;
const orderedListRegex = /^\s*\d+\.\s+(.+)$/;
const unorderedListRegex = /^\s*[-*]\s+(.+)$/;
const tableSeparatorRegex = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/;

function parseInline(text: string): InlinePart[] {
  const parts: InlinePart[] = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", text: text.slice(lastIndex, match.index) });
    }

    const token = match[0];
    if (token.startsWith("**")) {
      parts.push({ type: "bold", text: token.slice(2, -2) });
    } else if (token.startsWith("`")) {
      parts.push({ type: "code", text: token.slice(1, -1) });
    } else {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        parts.push({ type: "link", text: linkMatch[1], href: linkMatch[2] });
      } else {
        parts.push({ type: "text", text: token });
      }
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    parts.push({ type: "text", text: text.slice(lastIndex) });
  }

  return parts;
}

function parseTableRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function parseBlocks(content: string): Block[] {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let index = 0;

  const pushParagraph = (paragraphLines: string[]) => {
    const text = paragraphLines.join("\n").trim();
    if (text) blocks.push({ type: "paragraph", text });
  };

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    const codeFence = trimmed.match(codeFenceRegex);
    if (codeFence) {
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !codeFenceRegex.test(lines[index].trim())) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push({ type: "code", language: codeFence[1], text: codeLines.join("\n") });
      continue;
    }

    if (/^---+$/.test(trimmed)) {
      blocks.push({ type: "divider" });
      index += 1;
      continue;
    }

    const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      blocks.push({
        type: "heading",
        level: heading[1].length as 1 | 2 | 3,
        text: heading[2],
      });
      index += 1;
      continue;
    }

    if (trimmed.startsWith(">")) {
      const quoteLines: string[] = [];
      while (index < lines.length && lines[index].trim().startsWith(">")) {
        quoteLines.push(lines[index].trim().replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push({ type: "quote", text: quoteLines.join("\n") });
      continue;
    }

    const unorderedMatch = line.match(unorderedListRegex);
    const orderedMatch = line.match(orderedListRegex);
    if (unorderedMatch || orderedMatch) {
      const ordered = Boolean(orderedMatch);
      const items: string[] = [];
      while (index < lines.length) {
        const current = lines[index];
        const currentMatch = ordered
          ? current.match(orderedListRegex)
          : current.match(unorderedListRegex);
        if (!currentMatch) break;
        items.push(currentMatch[1]);
        index += 1;
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }

    if (
      line.includes("|") &&
      index + 1 < lines.length &&
      tableSeparatorRegex.test(lines[index + 1])
    ) {
      const rows = [parseTableRow(line)];
      index += 2;
      while (index < lines.length && lines[index].includes("|") && lines[index].trim()) {
        rows.push(parseTableRow(lines[index]));
        index += 1;
      }
      blocks.push({ type: "table", rows });
      continue;
    }

    const paragraphLines = [line];
    index += 1;
    while (
      index < lines.length &&
      lines[index].trim() &&
      !codeFenceRegex.test(lines[index].trim()) &&
      !lines[index].trim().startsWith("#") &&
      !lines[index].trim().startsWith(">") &&
      !orderedListRegex.test(lines[index]) &&
      !unorderedListRegex.test(lines[index])
    ) {
      paragraphLines.push(lines[index]);
      index += 1;
    }
    pushParagraph(paragraphLines);
  }

  return blocks;
}

export function MarkdownRenderer({ content, compact = false }: MarkdownRendererProps) {
  const theme = useTheme();
  const blocks = parseBlocks(content);

  const renderInline = (text: string, keyPrefix: string) =>
    parseInline(text).map((part, index) => {
      const key = `${keyPrefix}-${index}`;
      if (part.type === "bold") {
        return (
          <Text key={key} fontWeight="700" color="$color">
            {part.text}
          </Text>
        );
      }
      if (part.type === "code") {
        return (
          <Text
            key={key}
            fontSize={13}
            color="$color"
            bg="$backgroundHover"
            style={{ fontFamily: "monospace" }}
          >
            {` ${part.text} `}
          </Text>
        );
      }
      if (part.type === "link") {
        return (
          <Text
            key={key}
            color="$primary"
            textDecorationLine="underline"
            onPress={() => {
              void Linking.openURL(part.href);
            }}
          >
            {part.text}
          </Text>
        );
      }
      return part.text;
    });

  return (
    <View style={tw`gap-2`}>
      {blocks.map((block, index) => {
        const key = `${block.type}-${index}`;
        if (block.type === "heading") {
          const fontSize = block.level === 1 ? 18 : block.level === 2 ? 16 : 15;
          return (
            <Text key={key} fontSize={fontSize} fontWeight="700" lineHeight={fontSize + 7} color="$color">
              {renderInline(block.text, key)}
            </Text>
          );
        }

        if (block.type === "paragraph") {
          return (
            <Text key={key} fontSize={compact ? 13 : 15} lineHeight={compact ? 19 : 22} color="$color">
              {renderInline(block.text, key)}
            </Text>
          );
        }

        if (block.type === "quote") {
          return (
            <View
              key={key}
              style={[
                tw`pl-3 py-1`,
                { borderLeftWidth: 3, borderLeftColor: theme.borderColor.val },
              ]}
            >
              <Text fontSize={compact ? 12 : 14} lineHeight={compact ? 18 : 21} color="$placeholderColor">
                {renderInline(block.text, key)}
              </Text>
            </View>
          );
        }

        if (block.type === "list") {
          return (
            <View key={key} style={tw`gap-1`}>
              {block.items.map((item, itemIndex) => (
                <View key={`${key}-${itemIndex}`} style={tw`flex-row items-start gap-2`}>
                  <Text fontSize={compact ? 13 : 15} lineHeight={compact ? 19 : 22} color="$placeholderColor">
                    {block.ordered ? `${itemIndex + 1}.` : "•"}
                  </Text>
                  <Text flex={1} fontSize={compact ? 13 : 15} lineHeight={compact ? 19 : 22} color="$color">
                    {renderInline(item, `${key}-${itemIndex}`)}
                  </Text>
                </View>
              ))}
            </View>
          );
        }

        if (block.type === "code") {
          return (
            <ScrollView
              key={key}
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{
                borderRadius: 10,
                borderWidth: 1,
                borderColor: theme.borderColor.val,
                backgroundColor: theme.backgroundHover.val,
              }}
              contentContainerStyle={tw`p-3`}
            >
              <Text fontSize={12} lineHeight={18} color="$color" style={{ fontFamily: "monospace" }}>
                {block.text}
              </Text>
            </ScrollView>
          );
        }

        if (block.type === "divider") {
          return (
            <View
              key={key}
              style={{
                height: 1,
                backgroundColor: theme.borderColor.val,
                marginVertical: 4,
              }}
            />
          );
        }

        if (block.type === "table") {
          return (
            <ScrollView key={key} horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ borderWidth: 1, borderColor: theme.borderColor.val, borderRadius: 8 }}>
                {block.rows.map((row, rowIndex) => (
                  <View key={`${key}-${rowIndex}`} style={tw`flex-row`}>
                    {row.map((cell, cellIndex) => (
                      <View
                        key={`${key}-${rowIndex}-${cellIndex}`}
                        style={{
                          minWidth: 96,
                          paddingHorizontal: 8,
                          paddingVertical: 6,
                          borderRightWidth: cellIndex === row.length - 1 ? 0 : 1,
                          borderBottomWidth: rowIndex === block.rows.length - 1 ? 0 : 1,
                          borderColor: theme.borderColor.val,
                          backgroundColor: rowIndex === 0 ? theme.backgroundHover.val : "transparent",
                        }}
                      >
                        <Text fontSize={12} lineHeight={18} fontWeight={rowIndex === 0 ? "700" : "400"} color="$color">
                          {renderInline(cell, `${key}-${rowIndex}-${cellIndex}`)}
                        </Text>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            </ScrollView>
          );
        }

        return null;
      })}
    </View>
  );
}
