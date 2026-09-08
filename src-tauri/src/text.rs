// Only split between complete Markdown/LaTeX blocks. Size limits are soft: a
// complete equation or code block is more important than an exact batch size.
#[derive(Default)]
struct Delimiters {
    dollar: Option<usize>,
    brackets: Vec<char>,
    environments: Vec<String>,
    fence: Option<(char, usize)>,
}
impl Delimiters {
    fn closed(&self) -> bool {
        self.dollar.is_none()
            && self.brackets.is_empty()
            && self.environments.is_empty()
            && self.fence.is_none()
    }
    fn line(&mut self, line: &str) {
        let trimmed = line.trim_start();
        if let Some((c, count)) = self.fence {
            if trimmed.chars().take_while(|v| *v == c).count() >= count {
                self.fence = None;
            }
            return;
        }
        for c in ['`', '~'] {
            let count = trimmed.chars().take_while(|v| *v == c).count();
            if count >= 3 {
                self.fence = Some((c, count));
                return;
            }
        }
        let chars: Vec<char> = line.chars().collect();
        let mut i = 0;
        while i < chars.len() {
            if chars[i] == '\\' && i + 1 < chars.len() {
                match chars[i + 1] {
                    '[' | '(' => {
                        self.brackets.push(chars[i + 1]);
                        i += 2;
                        continue;
                    }
                    ']' | ')' => {
                        self.brackets.pop();
                        i += 2;
                        continue;
                    }
                    '\\' | '$' => {
                        i += 2;
                        continue;
                    }
                    _ => {}
                }
                let rest: String = chars[i..].iter().collect();
                for (prefix, opening) in [("\\begin{", true), ("\\end{", false)] {
                    if let Some(tail) = rest.strip_prefix(prefix) {
                        if let Some(end) = tail.find('}') {
                            let env = &tail[..end];
                            // A document wrapper is not a mathematical environment.
                            if !matches!(env, "document" | "itemize" | "enumerate") {
                                if opening {
                                    self.environments.push(env.into());
                                } else if self.environments.last().map(String::as_str) == Some(env)
                                {
                                    self.environments.pop();
                                }
                            }
                            i += prefix.chars().count() + env.chars().count();
                            break;
                        }
                    }
                }
            } else if chars[i] == '$' {
                let count = if chars.get(i + 1) == Some(&'$') { 2 } else { 1 };
                if self.dollar == Some(count) {
                    self.dollar = None;
                } else if self.dollar.is_none() {
                    self.dollar = Some(count);
                }
                i += count;
                continue;
            }
            i += 1;
        }
    }
}
pub fn blocks(text: &str) -> Vec<String> {
    let mut state = Delimiters::default();
    let mut result = Vec::new();
    let mut current = String::new();
    for line in text.split_inclusive('\n') {
        if state.closed() && line.trim_start().starts_with("# ") && !current.trim().is_empty() {
            result.push(std::mem::take(&mut current));
        }
        current.push_str(line);
        state.line(line);
        if state.closed() && line.trim().is_empty() {
            result.push(std::mem::take(&mut current));
        }
    }
    if !current.is_empty() {
        result.push(current);
    }
    result
}
pub fn balanced(text: &str) -> bool {
    let mut state = Delimiters::default();
    for line in text.lines() {
        state.line(line);
    }
    state.closed()
}
pub fn chinese(text: &str) -> bool {
    text.chars().any(|c| ('\u{4e00}'..='\u{9fff}').contains(&c))
}
// Match only a complete standalone command. A line such as
// `\section{定义} 向量满足 $v\in V$` contains content after the heading.
fn standalone_command(line: &str, command: &str) -> bool {
    let Some(mut rest) = line.strip_prefix(command) else {
        return false;
    };
    rest = rest.trim_start();
    if let Some(tail) = rest.strip_prefix('*') {
        rest = tail.trim_start();
    }
    if let Some(tail) = rest.strip_prefix('[') {
        let Some(end) = tail.find(']') else {
            return false;
        };
        rest = tail[end + 1..].trim_start();
    }
    if !rest.starts_with('{') {
        return false;
    }
    let mut depth = 0;
    let mut escaped = false;
    for (i, c) in rest.char_indices() {
        if escaped {
            escaped = false;
            continue;
        }
        match c {
            '\\' => escaped = true,
            '{' => depth += 1,
            '}' => {
                depth -= 1;
                if depth == 0 {
                    return rest[i + 1..].trim().is_empty();
                }
            }
            _ => {}
        }
    }
    false
}

pub fn meaningful(text: &str) -> bool {
    let mut fence: Option<(char, usize)> = None;
    for line in text.lines().map(str::trim) {
        if line.is_empty() {
            continue;
        }
        if let Some((marker, count)) = fence {
            if line.chars().take_while(|c| *c == marker).count() >= count {
                fence = None;
                continue;
            }
            // Code/preprocessor lines beginning with # are not Markdown titles.
            if line.chars().any(char::is_alphanumeric) {
                return true;
            }
            continue;
        }
        let marker = line.chars().next().unwrap();
        let count = line.chars().take_while(|c| *c == marker).count();
        if matches!(marker, '`' | '~') && count >= 3 {
            // Inline fenced content must not be mistaken for an opening fence.
            if line[count..].contains(&marker.to_string().repeat(count)) {
                if line[count..].chars().any(char::is_alphanumeric) {
                    return true;
                }
            } else {
                fence = Some((marker, count));
            }
            continue;
        }
        let hashes = line.chars().take_while(|c| *c == '#').count();
        let heading = (1..=6).contains(&hashes)
            && (line.len() == hashes || line[hashes..].starts_with(char::is_whitespace));
        // Headings that themselves state formulas/definitions may carry knowledge.
        if heading
            && !line.contains(['=', '$', ':', '：', '。', '∈', '≤', '≥'])
            && !line.contains("\\(")
            && !line.contains("\\[")
        {
            continue;
        }
        if line.chars().all(|c| "-$*_=|`~ ".contains(c))
            || [".md", ".tex", ".txt", ".markdown"]
                .iter()
                .any(|ext| line.ends_with(ext) && !line.chars().any(char::is_whitespace))
            || ["\\maketitle", "\\tableofcontents"].contains(&line)
            || [
                "\\section",
                "\\subsection",
                "\\subsubsection",
                "\\chapter",
                "\\part",
                "\\label",
                "\\title",
                "\\author",
                "\\date",
                "\\input",
                "\\include",
                "\\begin",
                "\\end",
                "\\documentclass",
                "\\usepackage",
            ]
            .iter()
            .any(|command| standalone_command(line, command))
        {
            continue;
        }
        if line.chars().any(char::is_alphanumeric) {
            return true;
        }
    }
    false
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn multiline_math_and_code_remain_whole() {
        for equation in [
            "$$\nx = \\frac{a}{b}\n\n+ c\n$$",
            "\\[\n\\begin{aligned}\nx &= a \\\\\n\ny &= b\n\\end{aligned}\n\\]",
            "\\begin{equation}\nx=1\n\n+2\n\\end{equation}",
            "```latex\n$$\n\nx=1\n$$\n```",
        ] {
            let text = format!("定义。\n\n{equation}\n\n结论。\n");
            let pieces = blocks(&text);
            assert_eq!(pieces.concat(), text);
            assert!(pieces.iter().any(|p| p.contains(equation)));
            assert!(pieces.iter().all(|p| balanced(p)));
        }
    }
    #[test]
    fn distinguishes_standalone_structure_from_formatted_knowledge() {
        for text in [
            r"\section{定义}",
            r"\section*{定义}",
            r"\section[简写]{完整标题}",
            r"\title{含有{嵌套}的标题}",
            r"\documentclass[a4paper]{article}",
            r"\usepackage{amsmath}",
            r"\begin{equation}",
            "# 线性代数",
            "notes.tex",
            "```rust\n```",
        ] {
            assert!(!meaningful(text), "{text}");
        }
        for text in [
            r"\section{定义} 向量满足 $v\in V$",
            r"\section{定义} $x=\frac{1}{2}$",
            r"\usepackage{amsmath} 用于数学排版。",
            "#define MAX_SIZE 10",
            "# 定义：维数是基中向量的个数。",
            "### $a=b$",
            "```c\n#define MAX_SIZE 10\n```",
            "```x=1```",
            "| 名称 | 定义 |\n| 基 | 线性无关的生成集 |",
            "\\begin{equation}\nx=1\n\\end{equation}",
        ] {
            assert!(meaningful(text), "{text}");
        }
    }
    #[test]
    fn rejects_incomplete_math_and_formatting_only() {
        assert!(!balanced("$$\nx=1"));
        assert!(!balanced("\\[x=1"));
        assert!(!meaningful("$$\n$$"));
        assert!(!meaningful("# notes.md\n\n---"));
        assert!(meaningful("1+1=3"));
    }
}

// Prefer sentence boundaries and never cut an open formula or fenced block.
// A single indivisible math/code block may exceed the soft budget.
pub fn bounded_blocks(text: &str, budget: usize) -> Vec<String> {
    let mut result = Vec::new();
    for block in blocks(text) {
        let mut start = 0;
        let mut count = 0;
        for (i, c) in block.char_indices() {
            count += 1;
            let end = i + c.len_utf8();
            let boundary = matches!(c, '\n' | '。' | '！' | '？' | '.' | '!' | '?')
                || (count >= budget.saturating_mul(2)
                    && (c.is_whitespace() || chinese(&c.to_string())));
            if count >= budget && boundary && balanced(&block[start..end]) {
                result.push(block[start..end].to_owned());
                start = end;
                count = 0;
            }
        }
        if start < block.len() {
            result.push(block[start..].to_owned());
        }
    }
    result
}
