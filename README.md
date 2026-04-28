# POI Builder

**IB PYP Programme of Inquiry 협업 설계 웹툴**

학교 단위 POI(Programme of Inquiry)를 여러 교사가 동시에 설계·검토·확정할 수 있는 도구입니다. 6개 초학문적 주제(TDT) × 학년별 UOI(Unit of Inquiry) 매트릭스를 시각화하고, 2022 개정 교육과정 성취기준과의 매핑을 기본 탑재합니다.

> "개발자가 아니라 수업 설계자" — 기술적 완성도보다 교사의 인지 부담 경감과 협업 가능성을 최우선.

---

## 주요 특징

- **매트릭스 시각화** — 학년 × 주제 그리드로 전체 POI 한눈에 확인
- **협업 워크플로우** — `draft → in_review → approved → finalized → archived` 상태 흐름
- **낙관적 동시성 제어** — 변경 이력 자동 기록, 충돌 시 병합 UX 제공
- **2022 개정 교육과정 매핑** — 도덕·사회·과학 성취기준 태깅
- **구/신 기술어 병존** — 2025 PYP 개편 및 2027 전환기 대응
- **다양한 내보내기** — PDF(공문 보고용), Word, Markdown(Obsidian), JSON(백업)

## 아키텍처

```
교사 브라우저
    ↓ HTTPS + Google ID Token
GitHub Pages (정적 프론트엔드)
    ↓ fetch (JSON)
Google Apps Script Web App (API 게이트웨이)
    ↓ SpreadsheetApp API
Google Sheets (DB · Single Source of Truth)
```

- **프론트엔드**: Vanilla HTML/CSS/JS, Chart.js, Google Identity Services
- **백엔드**: Google Apps Script (clasp 개발)
- **저장소**: Google Sheets (11개 시트 구조)

## 폴더 구조

```
poi-builder/
├── index.html              # 교사용 메인
├── admin.html              # 수석교사용 관리자
├── login.html              # 로그인
├── css/                    # 스타일시트
├── js/                     # 프론트엔드 로직
├── assets/                 # 아이콘 · 폰트
├── gas/                    # Google Apps Script (clasp 관리)
├── docs/                   # 기획 · 매뉴얼 · API 문서
└── scripts/                # 시드 · 유틸 스크립트
```

## 개발 로드맵

| Phase | 기간 | 목표 |
| ----- | ---- | ---- |
| 0 | 1주 | 인프라 세팅 · 상수 데이터 준비 |
| 1 | 2주 | 인증 · 읽기/쓰기 MVP |
| 2 | 2주 | 협업 워크플로우 (검토 · 승인 · 확정) |
| 3 | 2주 | 내보내기 · 교육과정 매핑 |
| 4 | 2주 | 관리자 고급 기능 · 운영 |

자세한 내용은 [개발 계획서](docs/development-plan.md)를 참고하세요.

## 상태

🚧 **Phase 0 진행 중** — 인프라 세팅 단계

## 문서

- [개발 계획서 (v3.2)](docs/development-plan.md)
- [Sheets 스키마 (v3.2)](docs/sheets-schema.md)
- 사용자 매뉴얼 (Phase 4에서 작성 예정)
- 관리자 매뉴얼 (Phase 4에서 작성 예정)
- GAS API 레퍼런스 (Phase 2 이후 작성 예정)

## 작성자

**룰루랄라 한기쌤** (대구 남부초)

## 라이선스

추후 결정 (Phase 0 완료 전)
