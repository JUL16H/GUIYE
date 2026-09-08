use super::*;

fn terms(point: &KnowledgePoint) -> HashSet<String> {
    let text = format!(
        "{} {}",
        point.label,
        point.detail.chars().take(500).collect::<String>()
    )
    .to_lowercase();
    let chars: Vec<_> = text.chars().collect();
    let mut terms: HashSet<_> = chars
        .windows(2)
        .filter(|pair| pair.iter().all(|c| c.is_alphanumeric()))
        .map(|pair| pair.iter().collect::<String>())
        .collect();
    terms.extend(
        text.split(|c: char| !c.is_ascii_alphanumeric())
            .filter(|w| w.len() >= 3)
            .map(str::to_owned),
    );
    terms
}

// Find related concepts across all extraction batches. Model calls are bounded;
// string similarity only proposes candidates, never authorizes a merge itself.
pub(super) fn windows(points: &[KnowledgePoint]) -> Vec<Vec<String>> {
    let signatures: Vec<_> = points.iter().map(terms).collect();
    let mut index: HashMap<&str, Vec<usize>> = HashMap::new();
    for (i, signature) in signatures.iter().enumerate() {
        for term in signature {
            index.entry(term).or_default().push(i);
        }
    }
    let mut parent: Vec<_> = (0..points.len()).collect();
    fn root(parent: &mut [usize], i: usize) -> usize {
        if parent[i] != i {
            parent[i] = root(parent, parent[i]);
        }
        parent[i]
    }
    for (i, signature) in signatures.iter().enumerate() {
        let mut counts = HashMap::<usize, usize>::new();
        for term in signature {
            // Ignore corpus-wide boilerplate before enumerating its postings.
            if index[term.as_str()].len() > 64 {
                continue;
            }
            for &j in index[term.as_str()].iter().filter(|&&j| j > i) {
                *counts.entry(j).or_default() += 1;
            }
        }
        for (j, common) in counts {
            if common >= 3 && common * 5 >= signature.len().min(signatures[j].len()) {
                let a = root(&mut parent, i);
                let b = root(&mut parent, j);
                parent[b] = a;
            }
        }
    }
    let mut groups: std::collections::BTreeMap<usize, Vec<usize>> =
        std::collections::BTreeMap::new();
    for i in 0..points.len() {
        groups.entry(root(&mut parent, i)).or_default().push(i);
    }
    let mut windows = Vec::new();
    let mut packed = Vec::new();
    for group in groups.values().filter(|g| g.len() > 1) {
        if group.len() <= 40 {
            if packed.len() + group.len() > 40 {
                windows.push(std::mem::take(&mut packed));
            }
            packed.extend(group.iter().map(|&i| points[i].id.clone()));
        } else {
            for start in (0..group.len()).step_by(30) {
                let ids: Vec<_> = group[start..group.len().min(start + 40)]
                    .iter()
                    .map(|&i| points[i].id.clone())
                    .collect();
                if ids.len() > 1 {
                    windows.push(ids);
                }
            }
        }
    }
    if packed.len() > 1 {
        windows.push(packed);
    }
    // Overlap label-sorted windows so a duplicate at a batch edge isn't missed.
    let mut ordered: Vec<_> = points.iter().collect();
    ordered.sort_by(|a, b| a.label.cmp(&b.label));
    for start in (0..ordered.len()).step_by(30) {
        let ids: Vec<_> = ordered[start..ordered.len().min(start + 40)]
            .iter()
            .map(|p| p.id.clone())
            .collect();
        if ids.len() > 1 {
            windows.push(ids);
        }
    }
    // Avoid billing twice for a candidate set already compared in full.
    let mut compared = HashSet::new();
    windows.retain(|ids| {
        let mut pairs = Vec::new();
        for i in 0..ids.len() {
            for j in i + 1..ids.len() {
                let (a, b) = if ids[i] < ids[j] {
                    (&ids[i], &ids[j])
                } else {
                    (&ids[j], &ids[i])
                };
                pairs.push((a.clone(), b.clone()));
            }
        }
        if pairs.iter().all(|p| compared.contains(p)) {
            return false;
        }
        compared.extend(pairs);
        true
    });
    windows
}
