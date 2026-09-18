export const navigationItems = [
  { href: "/", label: "Home" },
  { href: "/submit", label: "Submit Job" },
  { href: "/about", label: "About" },
  { href: "/datasets", label: "Datasets" },
  { href: "/help", label: "Help" },
  { href: "/human-covid-ppi", label: "Human-COVID-PPI" },
];

export const manuscriptCitation = {
  authors: "Kaundal R, Loaiza CD, Duhan N, Flann N.",
  title:
    "deepHPI: a comprehensive deep learning platform for accurate prediction and visualization of host-pathogen protein-protein interactions.",
  journal: "Briefings in Bioinformatics. 2022;23(3):bbac125.",
  doi: "10.1093/bib/bbac125",
  doiUrl: "https://doi.org/10.1093/bib/bbac125",
  pubmedUrl: "https://pubmed.ncbi.nlm.nih.gov/35511057/",
};

export const serviceLimits = [
  { label: "Host sequences", value: "500", note: "maximum per job" },
  { label: "Pathogen sequences", value: "500", note: "maximum per job" },
  { label: "Candidate pairs", value: "10,000", note: "full screen or pairwise list" },
  { label: "Combined input", value: "2 million", note: "sequence characters" },
  { label: "Single sequence", value: "50,000", note: "characters maximum" },
  { label: "Accession fetch", value: "100", note: "maximum per request" },
];

export const featureOptions = [
  {
    id: "best",
    label: "Sensitive",
    short: "Best",
    note: "Runs the fuller descriptor stack used for the most sensitive interaction calls.",
  },
  {
    id: "fast",
    label: "Faster",
    short: "Fast",
    note: "Uses a lighter descriptor profile for quicker screening and iterative work.",
  },
];

export const modelOptions = [
  {
    id: "PP",
    label: "Plant-Pathogen",
    tag: "PP",
    note: "Sequence screening for plant host-pathogen protein interaction discovery.",
  },
  {
    id: "HBP",
    label: "Human-Bacteria",
    tag: "HBP",
    note: "Human host and bacterial pathogen interaction inference.",
  },
  {
    id: "HVP",
    label: "Human-Virus",
    tag: "HVP",
    note: "Human host and viral pathogen sequence interaction screening.",
  },
  {
    id: "AP",
    label: "Animal-Pathogen",
    tag: "AP",
    note: "General animal host-pathogen interaction analysis across protein sets.",
  },
];

export const aboutParagraphs = [
  "Host-pathogen protein interactions shape infection, immunity, signaling, and host adaptation across many disease systems. DeepHPI was built to make sequence-based HPI screening available through a single web environment where investigators can move directly from FASTA submission to ranked interaction reports and network-level inspection.",
  "The predictor combines deep learning models with sequence-derived representations so that users can explore interaction evidence without requiring a custom cluster pipeline or one-off orchestration scripts. The interface is organized around the scientific workflow itself: upload or paste sequences, choose the biological model family, select the prediction mode, then review interaction tables and network structure in dedicated report pages.",
  "DeepHPI is designed for practical discovery work. It keeps the analysis surface focused, exposes the prediction configuration clearly, and lets the resulting interaction space be explored as both a sortable report and a connected host-pathogen network.",
];

export const datasetParagraphs = [
  "The DeepHPI model families were trained from curated host-pathogen interaction resources and benchmark collections assembled across plant, human-bacteria, human-virus, and broader animal-pathogen systems.",
  "Positive examples were consolidated from published host-pathogen interaction studies and curated repositories, then organized by biological system before model development. Negative reference sets were combined from large non-interaction resources to preserve a realistic imbalance between observed interactions and the much larger background interaction space.",
  "The webserver exposes the trained inference models directly so investigators can submit their own protein cohorts without reproducing the original training workflow. The dataset page remains focused on the scientific provenance of those model families and the systems they were designed to screen.",
];

export const helpItems = [
  {
    question: "What input does DeepHPI accept?",
    answer:
      "DeepHPI accepts host and pathogen sequences in FASTA format. You can upload a FASTA file, paste sequences, or retrieve protein FASTA records from UniProt or NCBI Protein accessions. Each dataset must include unique, valid FASTA identifiers.",
  },
  {
    question: "How should I choose between Sensitive and Faster mode?",
    answer:
      "Sensitive mode uses the fuller descriptor combination behind the strongest model checkpoints and is the default when the primary goal is recall. Faster mode is better for rapid screening, repeated exploratory runs, and very large sequence sets.",
  },
  {
    question: "What does the pairwise list do?",
    answer:
      "The optional pairwise file lets you restrict DeepHPI to a predefined interaction space. It should be a tab-separated file with exactly two columns and no header row: host protein accession in the first column and pathogen protein accession in the second.",
  },
  {
    question: "What appears in the results report?",
    answer:
      "The report page shows the submitted model family, prediction mode, job status, interaction counts, and a ranked table of predicted host-pathogen protein pairs with confidence scores. A dedicated network page is linked directly from the report.",
  },
  {
    question: "How are confidence scores defined?",
    answer:
      "Confidence is reported as the model output probability for the predicted positive interaction. DeepHPI filters the final report to pairs above the positive decision threshold and preserves the probability so users can sort and inspect the strength of each call.",
  },
];

export const helpSections = [
  {
    title: "1. Prepare the input sequences",
    body:
      "DeepHPI accepts host and pathogen sequences in FASTA format. Each sequence should begin with a unique FASTA identifier followed by the sequence. You may paste sequences, upload FASTA files, or retrieve protein records from UniProt or NCBI Protein accessions independently for the host and pathogen inputs. Multiple sequences can be submitted in one run subject to the displayed service limits.",
  },
  {
    title: "2. Choose the appropriate model family",
    body:
      "The model family should match the biological system under study. Plant-Pathogen is intended for plant host and pathogen proteins, Human-Bacteria for human host and bacterial pathogen pairs, Human-Virus for human host and viral proteins, and Animal-Pathogen for broader host-pathogen sequence screening beyond the other specific categories. Selecting the correct family is important because each setting corresponds to a different trained inference profile.",
  },
  {
    title: "3. Select the prediction mode",
    body:
      "DeepHPI provides two runtime modes. Sensitive mode uses the fuller descriptor configuration and is recommended when the priority is broader recovery of possible interactions. Faster mode uses a lighter configuration to reduce runtime and is useful for exploratory screening, repeated tests, or larger sequence sets. In either case, the report preserves probability-ranked predictions for downstream review.",
  },
  {
    title: "4. Optionally restrict the interaction space",
    body:
      "The pairwise restriction field can be used when you already have a candidate interaction list and want DeepHPI to score only those specific host-pathogen pairs. The expected format is a two-column tab-separated list with host protein identifier in the first column and pathogen protein identifier in the second. If no pairwise restriction is provided, DeepHPI evaluates the full submitted host and pathogen sequence sets.",
  },
  {
    title: "5. Review the report and network pages",
    body:
      "After submission, DeepHPI creates a dedicated results page for the job. The report page summarizes the selected model family, prediction mode, sequence counts, and ranked interaction calls together with confidence scores. From that page, users can open the network view to inspect the interaction structure visually, review node connectivity, and export the network for downstream use.",
  },
  {
    title: "6. Understand the confidence scores",
    body:
      "Confidence values shown in the report correspond to the probability assigned by the model to the predicted positive interaction. These values are useful for sorting, prioritization, and follow-up review. Higher confidence scores indicate stronger model support for a given host-pathogen protein pair, but they should still be interpreted in the context of the biological system and any independent evidence available to the investigator.",
  },
];

export const covidProteins = [
  "SARS-CoV-2_ORF3b",
  "SARS-CoV-2_E",
  "SARS-CoV-2_M",
  "SARS-CoV-2_N",
  "SARS-CoV-2_spike",
  "SARS-CoV-2_nsp1",
  "SARS-CoV-2_nsp2",
  "SARS-CoV-2_nsp3",
  "SARS-CoV-2_nsp4",
  "SARS-CoV-2_nsp5",
  "SARS-CoV-2_nsp6",
  "SARS-CoV-2_nsp7",
  "SARS-CoV-2_nsp8",
  "SARS-CoV-2_nsp9",
  "SARS-CoV-2_nsp10",
  "SARS-CoV-2_nsp13",
  "SARS-CoV-2_nsp14",
  "SARS-CoV-2_nsp15",
  "SARS-CoV-2_nsp16",
  "SARS-CoV-2_ORF3a",
  "SARS-CoV-2_ORF6",
  "SARS-CoV-2_ORF7a",
  "SARS-CoV-2_ORF7b",
  "SARS-CoV-2_ORF8",
  "SARS-CoV-2_ORF9b",
  "SARS-CoV-2_ORF9c",
  "SARS-CoV-2_ORF10",
];

export const overviewStats = [
  { label: "Model Families", value: "4", note: "Plant, human-bacteria, human-virus, and animal-pathogen prediction modes." },
  { label: "Prediction Modes", value: "2", note: "Sensitive and Faster runtimes driven by the active DeepSeqHPI checkpoints." },
  { label: "Report Surfaces", value: "3", note: "Submission workspace, ranked result report, and interactive network atlas." },
];

export const demoByModel = {
  PP: {
    host: `>Ciclev10002055m
MASNNQPPQKQDTQPGKEHVMNPIPQFTSPDYTPSNKLRGMVALVTGGDSGIGRAVCHCFAQEGATVAFTYVKPQEDKDAKETLEMLRKAKTPDAKDPMAISADLGFDENCKRVVDEVVNAYGKIDILVNNAAEQYECGSVEDIDESRLERVFRTNIFSYFFMARHALKHMKAGSSIINTTSVNAYKGNAKLLDYTSTKGAIVAFTRGLALQQVERGIRVNGVAPGPIWTPLIPASFTEEETAQFGNQVPMKRAGQPIEVAPCFVFLACNHCSSYITGQVLHPNGGTIVNG
>Ciclev10008405m
MQINEALGEVSFRLELTTPACPIKDMFEQRANEVVLAIPWVNKVNVTMSAQPARPIFAEQLPEGLQKISNIVAVSSCKGGVGKSTVAVNLAYTLAGMGARVGIFDADVYGPSLPTMVSPENRLLEMNPEKRTIIPTEYLGVKLVSFGFSGQGRAIMRGPMVSGVINQLLTTTEWGELDYLVIDMPPGTGDIQLTLCQVVPLTAAVIVTTPQKLAFIDVAKGVRMFSKLKVPCIAVVENMCHFDADGKRYYPFGRGSGSQVVQQFGIPHLFDLPIRPTLSASGDSGMPEVAADPCGEVANTFQDLGVCVVQQCAKIRQQVSTAVIYDKSIKAIKVKVPQSDEEFFLHPATVRRNDRSAQSVDEWTGDQKLQYTDVPEDIEPEEIRPMGNYAVSITWPDGFSQIAPYDQLQTMERLVDVPQPTPV`,
    pathogen: `>HopO1-1_Pto_DC3000
MGNICGTSGSNHVYSPPISPQHASGSSTPVPSASGTMLSLSHEQILSQNYASNIKGKYRTNPRKGPSPRLSDTLMKQALSSVITQEKKRLKSQPKSIAQDIQPPNSMIKNALDEKDSHPFGDCFSDDEFLAIHLYTSCLYRPINHHLRYAPKNDVAPVVEAMNSGLAKLAQYPDYQVSGQLHRGIKQKMDDGEVMSRFKPGNTYRDDAFMSTSTRMDVTEEFTSDVTLHLQSSSAVNIGPFSKNPYEDEALIPPLTPFKVTGLHKQDDRWHVHLNEIAESSDE
>HopF3_Pph_Race6
MGICASSSRNQYSPAVSNTCSPQHVASHGNLASSGGNRITSVDQLNSTERKRFLERQDPMRMFNFKKDTPVYRTMSPEFLVDGRVSGNPISRTWVRDHESLRPNPNGGFPEGTSNAYWPVIREARDLGPSLNVMTGGPSYSRDGDINVRMRLGDFIDRGGKVYLDNSAAGGDRQKTIPLVITLPEGQSVPAEKIVSAS`,
  },
  HBP: {
    host: `>NP_006248.1
MSPFLRIGLSNFDCGSCQSCQGEAVNPYCAVLVKEYVESENGQMYIQKKPTMYPPWDSTFDAHINKGRVMQIIVKGK
>O43292
MGLLSDPVRRRALARLVLRLNAPLCVLSYVAGIAWFLALVFPPLTQRTYMSENAMGSTMVEEQFAGGDRARAFARDFA`,
    pathogen: `>NP_705926.1
PQVTLWQRPLVTIKIGGQLKEALLDTGADDTVLEEMSLPGRWKPKMIGGIGGFIKVRQYDQILIEICGHKAIGTVLVG
>NP_579876.2
GARASVLSGGELDRWEKIRLRPGGKKKYKLKHIVWASRELERFAVNPGLLETSEGCRQILGQLQPSLQTGSEELRSLY`,
  },
  HVP: {
    host: `>P04637_demo
MEEPQSDPSVEPPLSQETFSDLWKLLPENNVLSPLPSQAMDDLMLSPDDIEQWFTEDPGPDEAPRMPEAAPPVAPAPAAPTPAAPAP
>Q9UNM6
MKDVPGFLQQSQNSGPGQPAVWHRLEELYTKKLWHQLTLQVLDFVQDPCFAQGDGLIKLYENFISEFEHRVNPLSLVE`,
    pathogen: `>P04578
MRVKEKYQHLWRWGWRWGTMLLGMLMICSATEKLWVTVYYGVPVWKEATTTLFCASDAKAYDTEVHNVWATHACVPTD
>P05780
SLLTEVETPIRNEWGCRCNDSSDPLVIAANIIGILHLILWILDRLFFKCIYRRFKYGLKRGPSTEGVPESMREEYRKE`,
  },
  AP: {
    host: `>XP_027313055.1
MARGKKIGYSARQELKELLQKLEKDKETDILKQIEVARRQAEADKPEADVEALKEANAELEKQKQEAQQAAADKAAEAGADKPE
>XP_005628645.2
MALWMRLLPLLALLALWGPGPGAGSLQPLALEGSLQKRGIVEQCCTSICSLYQLENYCNVTQGCQHFCLPGQESACVKHCR`,
    pathogen: `>WP_012345678.1
MKKIGMTRDDEIEKLAEAGADVVVVATGGGTIGLAIAKELGADVVVVNNAGITPQQAIEALKKAGADVVVVSSGPEAP
>YP_009987654.1
MSDPNRVRDLRDKIRKILENNKDTVEVLEKLGVEVVEGEEVEVVTDDVVEQLKSKYGVVVKDSDGTIRLVEGDKVEVV`,
  },
};
