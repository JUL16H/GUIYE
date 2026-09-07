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
pub fn meaningful(text: &str) -> bool {
    let text = text.trim();
    if text.is_empty() {
        return false;
    }
    if text.lines().all(|line| {
        let line = line.trim();
        line.is_empty()
            || line.starts_with('#')
            || line.chars().all(|c| "-$*_=|`~ ".contains(c))
            || [".md", ".tex", ".txt", ".markdown"]
                .iter()
                .any(|ext| line.ends_with(ext) && !line.contains(' '))
            || [
                "\\begin{document}",
                "\\end{document}",
                "\\maketitle",
                "\\tableofcontents",
            ]
            .contains(&line)
            || line.starts_with("```")
            || line.starts_with("~~~")
            || [
                "\\section{",
                "\\subsection{",
                "\\subsubsection{",
                "\\chapter{",
                "\\part{",
                "\\label{",
                "\\title{",
                "\\author{",
                "\\date{",
                "\\input{",
                "\\include{",
            ]
            .iter()
            .any(|prefix| line.starts_with(prefix) && line.ends_with('}'))
            || ["\\begin{", "\\end{"]
                .iter()
                .any(|prefix| line.starts_with(prefix) && line.find('}') == Some(line.len() - 1))
            || line.starts_with("\\documentclass")
            || line.starts_with("\\usepackage")
    }) {
        return false;
    }
    text.chars().any(char::is_alphanumeric)
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
    fn rejects_incomplete_math_and_formatting_only() {
        assert!(!balanced("$$\nx=1"));
        assert!(!balanced("\\[x=1"));
        assert!(!meaningful("$$\n$$"));
        assert!(!meaningful("# notes.md\n\n---"));
        assert!(meaningful("1+1=3"));
    }
}
