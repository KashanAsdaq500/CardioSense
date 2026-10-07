\# CardioSense — Explainable ECG Intelligence Platform



CardioSense is an AI-powered ECG analysis platform developed as a clinical decision-support research prototype. It classifies ECG images into four categories, provides Grad-CAM visual explanations, and uses Retrieval-Augmented Generation (RAG) to provide evidence-grounded medical context.



> \*\*Important:\*\* CardioSense is a research and decision-support prototype. It is not intended to replace a qualified medical professional or provide autonomous medical diagnosis.



\## Features



\* ECG image classification into four categories

\* ResNet18 transfer-learning model

\* 99.29% test accuracy on the held-out test set

\* Grad-CAM visual explainability

\* RAG-based evidence-grounded explanations

\* Clerk authentication

\* Supabase PostgreSQL database

\* FastAPI backend

\* Next.js frontend

\* Vercel deployment

\* Per-user ECG analysis history

\* External ECG image testing



\## ECG Classes



The model classifies ECG images into:



1\. Normal

2\. Abnormal Heartbeat

3\. History of Myocardial Infarction

4\. Myocardial Infarction



\## Model



The classification model uses ResNet18 pretrained on ImageNet with transfer learning.



\### Training Setup



\* Input size: 448 × 320

\* Optimizer: AdamW

\* Learning rate: 0.0001

\* Weight decay: 0.0001

\* Batch size: 16

\* Training epochs: 10

\* Train/Validation/Test split: 70% / 15% / 15%

\* Random seed: 42



\### Dataset



The ECG dataset contains 928 valid ECG images.



| Class                 |  Images |

| --------------------- | ------: |

| Normal                |     284 |

| Abnormal Heartbeat    |     233 |

| History of MI         |     172 |

| Myocardial Infarction |     239 |

| \*\*Total\*\*             | \*\*928\*\* |



The raw ECG dataset is kept private and is not included in this repository.



\## Results



The final model achieved:



\*\*Test Accuracy: 99.29%\*\*



| Class                 | Precision | Recall | F1-score |

| --------------------- | --------: | -----: | -------: |

| Normal                |     1.000 |  1.000 |    1.000 |

| Abnormal Heartbeat    |     1.000 |  0.971 |    0.986 |

| History of MI         |     0.963 |  1.000 |    0.981 |

| Myocardial Infarction |     1.000 |  1.000 |    1.000 |



The held-out test set contained 140 ECG images, with only one misclassification.



\## Explainability with Grad-CAM



CardioSense uses Grad-CAM (Gradient-weighted Class Activation Mapping) to highlight image regions that contributed to the model's prediction.



This provides a visual explanation of the model's prediction instead of showing only a class label and confidence score.



\## RAG and Medical Knowledge



CardioSense includes a curated ECG knowledge base stored in Supabase.



The RAG pipeline retrieves relevant medical and technical sources and generates a grounded explanation using Gemini.



The knowledge base covers:



\* ECG fundamentals

\* Normal ECG characteristics

\* Abnormal heartbeat patterns

\* Myocardial infarction

\* History of myocardial infarction

\* Grad-CAM and explainability

\* AI and ECG limitations



Sources include scientific statements and references from organizations and publications such as:



\* American Heart Association / American College of Cardiology / Heart Rhythm Society

\* World Health Organization

\* IEEE / Grad-CAM research



RAG explanations provide supporting context and should not be interpreted as an independent medical diagnosis.



\## System Architecture



```text

&#x20;                   +----------------------+

&#x20;                   |   Next.js Frontend   |

&#x20;                   |   ECG Upload / UI    |

&#x20;                   +----------+-----------+

&#x20;                              |

&#x20;                              v

&#x20;                   +----------------------+

&#x20;                   |     Clerk Auth       |

&#x20;                   |    User Identity     |

&#x20;                   +----------+-----------+

&#x20;                              |

&#x20;                              v

&#x20;                   +----------------------+

&#x20;                   |   FastAPI Backend    |

&#x20;                   |   /predict           |

&#x20;                   |   /history           |

&#x20;                   |   /health            |

&#x20;                   +------+---------+-----+

&#x20;                          |         |

&#x20;               +----------+         +-----------+

&#x20;               |                              |

&#x20;               v                              v

&#x20;      +-------------------+          +-------------------+

&#x20;      | ResNet18 /        |          | RAG + Gemini      |

&#x20;      | ONNX Runtime      |          | Knowledge Base   |

&#x20;      +---------+---------+          +---------+---------+

&#x20;                |                              |

&#x20;                +---------------+--------------+

&#x20;                                |

&#x20;                                v

&#x20;                   +----------------------+

&#x20;                   | Supabase PostgreSQL  |

&#x20;                   | Analysis History     |

&#x20;                   +----------------------+

```



\## Technology Stack



\### Frontend



\* Next.js

\* TypeScript

\* Tailwind CSS

\* Clerk



\### Backend



\* Python

\* FastAPI

\* ONNX Runtime



\### Machine Learning



\* PyTorch

\* Torchvision

\* ResNet18

\* Grad-CAM

\* Scikit-learn



\### AI and RAG



\* Gemini

\* Retrieval-Augmented Generation

\* Vector embeddings

\* Supabase Vector



\### Database



\* Supabase PostgreSQL

\* Per-user analysis history

\* Row-level access policies



\### Deployment and Development



\* Git

\* GitHub

\* Vercel

\* Google Colab

\* Antigravity



\## Authentication



CardioSense uses Clerk for authentication.



Authenticated users can access their ECG analysis history, while the backend verifies Clerk session tokens before allowing protected operations.



\## Deployment



The application is deployed using Vercel.



\* Frontend: Next.js on Vercel

\* Backend: FastAPI on Vercel

\* Database: Supabase

\* Authentication: Clerk



\## External Testing



Additional ECG images obtained from external and public sources were uploaded to the deployed application to test the complete production workflow.



The system successfully processed external ECG images and returned predictions, Grad-CAM explanations, and RAG-based context.



These tests demonstrate that the deployed pipeline works on images outside the original dataset. They should not be interpreted as formal clinical validation or external benchmark accuracy.



\## Limitations



CardioSense has several important limitations:



\* The model was trained on a specific ECG image dataset.

\* External ECG images can differ in layout, resolution, acquisition conditions, and patient population.

\* High model confidence does not guarantee clinical correctness.

\* The system is not clinically validated.

\* RAG-generated explanations depend on the retrieved knowledge and should be reviewed by qualified professionals.

\* The platform should be treated as a research and decision-support prototype.



\## Future Improvements



\* Larger and more diverse ECG datasets

\* External benchmark evaluation

\* AUROC and calibration analysis

\* More robust ECG preprocessing

\* Additional ECG classes

\* Improved clinical knowledge retrieval

\* Better uncertainty estimation

\* Prospective clinical validation



\## Project Structure



```text

CardioSense/

├── backend/

│   ├── auth.py

│   ├── rag/

│   └── ...

├── frontend/

│   ├── src/

│   └── ...

├── data/

│   ├── raw/

│   └── processed/

├── models/

│   └── cardiosense\_resnet18.pth

├── notebooks/

├── scratch/

├── venv/

├── requirements.txt

└── README.md

```



\## Disclaimer



CardioSense is an educational and research project demonstrating machine learning, explainable AI, RAG, authentication, databases, and cloud deployment.



It is not a medical device and should not be used as a substitute for professional medical diagnosis or treatment.



\## Author



\*\*Kashan Asdaq\*\*



Software Engineering | AI/ML | HealthTech



GitHub: KashanAsdaq500



