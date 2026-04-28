# POI Builder — IB PYP 협업형 탐구 프로그램 구성 웹툴

**최종 통합 개발 계획서 (v3.0)**

| 항목         | 내용                                                    |
| ------------ | ------------------------------------------------------- |
| 프로젝트명   | `poi-builder`                                           |
| 저장소       | `github.com/plusiam/poi-builder`                        |
| 배포         | GitHub Pages — `https://plusiam.github.io/poi-builder/` |
| 백엔드       | Google Apps Script Web App                              |
| 데이터베이스 | Google Sheets                                           |
| 인증         | Google Sign-In (GIS)                                    |
| 작성자       | 룰루랄라 한기쌤 (대구 남부초)                           |
| 작성일       | 2026-04-18                                              |
| 개발 기간    | 10주 (Phase 0 ~ Phase 4, v3.1에서 Phase 2 +1주 확장)   |

---

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [배경과 맥락](#2-배경과-맥락)
3. [사용자와 시나리오](#3-사용자와-시나리오)
4. [시스템 아키텍처](#4-시스템-아키텍처)
5. [IB PYP 도메인 지식 요약](#5-ib-pyp-도메인-지식-요약)
6. [데이터 모델 (Google Sheets)](#6-데이터-모델-google-sheets)
7. [GAS Web App API 명세](#7-gas-web-app-api-명세)
8. [권한 체계와 워크플로우](#8-권한-체계와-워크플로우)
9. [화면 사양](#9-화면-사양)
10. [입력 검증 규칙](#10-입력-검증-규칙)
11. [내보내기 사양](#11-내보내기-사양)
12. [기술 스택](#12-기술-스택)
13. [폴더 구조](#13-폴더-구조)
14. [개발 로드맵](#14-개발-로드맵)
15. [리스크 매트릭스](#15-리스크-매트릭스)
16. [품질·운영 기준](#16-품질운영-기준)
17. [부록 A: 상수 데이터](#부록-a-상수-데이터)

---

## 1. 프로젝트 개요

IB PYP의 **Programme of Inquiry(POI)**를 학교 단위로 설계·검토·확정·공유하기 위한 협업 웹 도구. 6개 초학문적 주제(TDT) × 학년별 UOI(Unit of Inquiry)를 매트릭스로 시각화하고, 여러 교사가 동시에 작업하면서 수석교사가 최종 확정하는 워크플로우를 지원한다. 2022 개정 교육과정 성취기준과의 매핑을 기본 탑재해 한국 공립 초등 맥락에서 바로 사용 가능한 형태를 지향한다.

**설계 철학**

> "개발자가 아니라 수업 설계자" — 기술적 완성도보다 교사의 인지 부담 경감과 협업 가능성을 최우선.

**3대 설계 원칙**

1. **Google Sheets가 유일한 진실의 원천**. 프론트는 래핑된 편집 인터페이스일 뿐.
2. **실시간 동시 편집 대신** 낙관적 동시성 + 변경 이력 + 충돌 경고.
3. **웹 UI가 정식 인터페이스**, Sheets 직접 편집은 감사·복구 용도로만.

---

## 2. 배경과 맥락

### 2.1 IB PYP 2025 개편 — 전환기 한복판

- IB는 2025년 PYP 프레임워크를 대폭 개편
- **2027년 9월까지 모든 PYP 학교 전환 필수**
- Transdisciplinary Theme Descriptors: 인간 중심 → 인간·자연 세계 균형
- 개념 용어 변경: Key/Related → Specified/Additional (설명자는 동일)
- Scope and Sequences → 통일 구조의 Subject Guides
- Inquiry Learning Progressions (ILPs) 신설

👉 이 도구는 **구·신 기술어 병존 관리**를 핵심 기능으로 삼는다.

### 2.2 한국 공립 초등 맥락

- 2022 개정 교육과정 성취기준과의 매핑 필수
- 도덕·사회·과학 중심 통합, 국어·수학·예술·체육은 보조 통합
- 남부초는 비(非)인증 일반 학교지만 PYP 철학을 교과 통합 차원에서 적용
- 공식 IB 포맷에 얽매이지 않는 유연성 필요

### 2.3 왜 새 도구가 필요한가

- Toddle, ManageBac 등 기존 상용 도구는 **유료 + 영어 전용 + 한국 교육과정 미지원**
- 구글 문서/시트로 수작업하면 구조·균형 진단이 불가능
- 수석교사가 전체 진행을 한눈에 관리할 뷰가 부재
- 2027 전환기 대응을 위한 구/신 기술어 병기 관리 필요

---

## 3. 사용자와 시나리오

### 3.1 주요 사용자 (Persona)

| 역할                        | 이름(예)  | 목표                                                  |
| --------------------------- | --------- | ----------------------------------------------------- |
| **수석교사 (Admin)**        | 여한기    | 학교 전체 POI 설계·검토·확정·공문용 출력              |
| **PYP 코디네이터 (Approver)** | 코디    | 단원 승인·반려 (수석과 분리 가능)                     |
| **학년부장 (Editor)**       | 김○○      | 담당 학년 6개 UOI 작성, 동료와 검토                   |
| **학년 동료 (Editor)**      | 박○○      | 자기 학년 UOI 초안 작성·수정                          |
| **팀 피드백 참여자 (Commenter)** | 동학년·전담 | **모든 단원에 댓글·이모지 반응**(편집 권한 없음) |
| **열람자 (Viewer)**         | 교감·교장 | 진행 상황 확인만                                      |

> v3.1 변경: 기존 `Reviewer` 역할은 `Approver`로 개명, 신규 `Commenter` 역할 추가. 피드백 권한과 승인 권한을 분리해 **팀원 전체 피드백** 모델을 지원한다.

### 3.2 대표 시나리오

**S1. 학년 협의 작성**

> 3학년 부장 김 선생님이 홈 화면에서 '3학년 Sharing the planet' UOI를 신규 생성 → Central Idea를 고심해 입력 → Lines of Inquiry 3개 작성 → Key Concepts 3개 선택 → 2022 개정 도덕·과학 성취기준 태깅 → 임시 저장 → 다음 학년 협의회 전까지 동료와 같이 보며 수정

**S2. 검토 요청 → 팀 피드백 → 수정**

> 김 선생님이 초안 완성 후 [검토 요청] 클릭 → 상태 `in_review` 전환 → **팀원 전체에게 알림** → 동학년 박 선생님이 "Central Idea가 사실 나열에 가깝다" 코멘트, 도덕 전담이 LOI #2 옆에 ❤️ + "[6도01-03] 매핑 검토 필요" 앵커 댓글, PYP 코디네이터가 ✅ Resolve 처리 → 김 선생님 수정 → PYP 코디네이터가 [승인] → 수석교사가 [확정]

> **피드백과 승인의 분리**: 누구나 댓글·이모지로 피드백할 수 있으나, `approve/reject`는 `approver`·`admin`만 가능.

**S3. 관리자 확정**

> 수석교사가 관리자 페이지 대시보드에서 `approved` 상태 UOI 일괄 확인 → 개별 [확정] 또는 [일괄 확정] → 각 UOI에 스냅샷 저장 + 잠금 → PDF 내보내기로 수석교사 실적 보고용 산출물 생성

**S4. 균형 진단**

> 학기 중반 수석교사가 히트맵 대시보드 접속 → 2학년 Key Concepts에 `reflection`이 누락된 걸 발견 → 2학년 부장과 협의 → 한 UOI 수정해 `reflection` 포함

**S5. 학년 종료 후 아카이브**

> 학년말 수석교사가 2026학년도 POI를 `archived` 처리 + 스냅샷 일괄 생성 → 2027학년도 새 POI를 Fork → 전환기 신(新) 기술어 적용 시작

**S6. 매트릭스에서 UOI 드래그 재배치**

> Phase 2 협의 중반, 학년부 김 선생님이 "이 단원은 'How the world works'보다 'Sharing the planet'이 더 어울린다"고 제안 → 매트릭스 셀에서 카드를 드래그해 다른 TDT 셀로 이동 → drop 시점에 (1) **TDT 균형 검증** (2) **2022 개정 학년군 정합성 검증** (3) **낙관적 잠금 충돌 검증** 자동 실행 → 학년 변경으로 [4사01-03] 코드가 무효화돼 ⚠️ 경고 배지 표시 → 김 선생님이 [6사…] 코드로 재매핑 → Changelog에 `action: 'move'` 기록

---

## 4. 시스템 아키텍처

### 4.1 삼단 구조

```
┌────────────────────────────────────────────────────────────┐
│                        교사 / 수석교사                      │
│                   (Chrome·Safari 브라우저)                  │
└───────────────────────────┬────────────────────────────────┘
                            │ HTTPS + Google ID Token
                            ▼
┌────────────────────────────────────────────────────────────┐
│           GitHub Pages (정적 프론트엔드 — Layer 1)          │
│           plusiam.github.io/poi-builder/                   │
│  ── Vanilla HTML / CSS / JS                                │
│  ── Google Sign-In (GIS) 라이브러리                        │
│  ── 매트릭스 · 편집 · 대시보드 화면                        │
└───────────────────────────┬────────────────────────────────┘
                            │ fetch (JSON over HTTPS)
                            │ Authorization: Bearer <ID Token>
                            ▼
┌────────────────────────────────────────────────────────────┐
│       Google Apps Script Web App (API 게이트웨이 — Layer 2) │
│  ── doGet / doPost 라우팅                                  │
│  ── Google ID Token 검증 → 이메일 추출                     │
│  ── Users 시트 조회로 권한 체크                            │
│  ── 비즈니스 로직 (낙관적 락, 상태 전이, 변경 이력)        │
│  ── 내보내기 생성 (PDF, Docs, Markdown)                    │
└───────────────────────────┬────────────────────────────────┘
                            │ SpreadsheetApp API (내부 호출)
                            ▼
┌────────────────────────────────────────────────────────────┐
│       Google Sheets (DB — Layer 3 · Single Source of Truth) │
│  ── POI_Meta · Units · Users · Comments · Changelog        │
│  ── Snapshots (확정본 보관)                                │
│  ── Constants_* (TDT / Concepts / Curriculum2022 등)       │
└────────────────────────────────────────────────────────────┘
```

### 4.2 왜 이 구조인가 — 기각된 대안

| 대안                                   | 기각 이유                                                     |
| -------------------------------------- | ------------------------------------------------------------- |
| Google AppSheet                        | UI 커스터마이징 제약, 라이선스 비용, GitHub Pages 요구와 충돌 |
| Sheets API 직접 호출 (브라우저→Sheets) | API 키 노출로 보안상 불가                                     |
| Firebase / Supabase 백엔드             | Sheets DB 요구와 충돌, 교사가 원본 조회 못함                  |
| 실시간 동시 편집 (Firestore 등)        | GAS로 불가능, 실제 현장 플로우에 불필요                       |

### 4.3 핵심 기술 흐름

1. **로그인**: 프론트가 Google Sign-In으로 ID Token 획득
2. **요청**: 프론트가 GAS Web App에 토큰 헤더 동봉하여 fetch
3. **검증**: GAS가 토큰을 Google에 검증 요청 → 이메일 확인
4. **인가**: Users 시트 조회로 역할·권한 확인
5. **실행**: 비즈니스 로직 수행, Sheets 읽기/쓰기
6. **응답**: JSON 반환, 프론트 렌더링

---

## 5. IB PYP 도메인 지식 요약

### 5.1 6개 Transdisciplinary Themes — 구/신 기술어

| 주제 (ID)                        | 한국어명                    | 신(新) 기술어 핵심                                                    |
| -------------------------------- | --------------------------- | --------------------------------------------------------------------- |
| `who_we_are`                     | 우리는 누구인가             | 정체성 탐구 — 건강·웰빙 / 관계·소속 / 배움·성장                       |
| `where_we_are_in_place_and_time` | 우리는 어떤 시공간에 있는가 | 역사와 방향성 — 시대·사건 / 공동체·문화·환경 / 이동·적응·변혁         |
| `how_we_express_ourselves`       | 우리는 어떻게 표현하는가    | 목소리·관점·표현 다양성 — 창의성 / 소통 방식 / 의도·해석·반응         |
| `how_the_world_works`            | 세상은 어떻게 작동하는가    | 세계와 현상 이해 — 패턴·주기·시스템 / 방법·도구 / 발견·설계·혁신      |
| `how_we_organize_ourselves`      | 우리는 어떻게 조직되는가    | 시스템·구조·네트워크 — 사회·생태 상호작용 / 생계·무역 / 협력·의사결정 |
| `sharing_the_planet`             | 지구를 공유하기             | 인간·자연 상호의존 — 권리·존엄 / 정의·평화 미래 / 자연·공존·지혜      |

구(舊) 기술어도 전체 데이터로 보관, 설정에서 토글 가능.

### 5.2 8개 Key Concepts (Specified Concepts)

| ID               | 한국어명 | 영문명         | 핵심 질문                            |
| ---------------- | -------- | -------------- | ------------------------------------ |
| `form`           | 형태     | Form           | What is it like?                     |
| `function`       | 기능     | Function       | How does it work?                    |
| `causation`      | 원인     | Causation      | Why is it like it is?                |
| `change`         | 변화     | Change         | How is it changing?                  |
| `connection`     | 연결     | Connection     | How is it connected to other things? |
| `perspective`    | 관점     | Perspective    | What are the points of view?         |
| `responsibility` | 책임     | Responsibility | What is our responsibility?          |
| `reflection`     | 성찰     | Reflection     | How do we know?                      |

**제약**: 한 UOI당 최대 3개

### 5.3 UOI 구성 9요소

| #   | 요소                    | 입력 형식       | 제약                         |
| --- | ----------------------- | --------------- | ---------------------------- |
| 1   | Transdisciplinary Theme | 드롭다운        | 6개 중 1                     |
| 2   | Central Idea            | 한 줄 텍스트    | 진술문 (물음표 감지 시 경고) |
| 3   | Lines of Inquiry        | 동적 리스트     | 3~4개, 구/진술문 형식        |
| 4   | Key Concepts            | 체크박스        | 최대 3개                     |
| 5   | Related Concepts        | 태그            | 자유 입력                    |
| 6   | Learner Profile         | 체크박스        | 10개 중 복수                 |
| 7   | ATL Skills              | 체크박스        | 5개 카테고리 복수            |
| 8   | Action                  | 멀티라인        | 자유 서술                    |
| 9   | 연계 교과 + 성취기준    | 드롭다운 + 태그 | 2022 개정 코드               |

### 5.4 POI 설계 규정

- 각 학년 6개 UOI (3~6세는 4개, 이때 `who_we_are`와 `how_we_express_ourselves`에 최소 2개씩)
- 6학년: 5개 UOI + 1개 Exhibition (선택)
- 8개 Key Concepts가 학년별로 균형 분포
- Science · Social Studies는 반드시 POI 내에서 다룸

---

## 6. 데이터 모델 (Google Sheets)

### 6.1 시트 전체 구성 (한 Spreadsheet)

| 시트명                     | 역할                | 예상 규모 |
| -------------------------- | ------------------- | --------- |
| `POI_Meta`                 | 학교·연도·버전 메타 | 1~수 행   |
| `Units`                    | UOI 본체 테이블     | 36~72 행  |
| `Users`                    | 이메일·이름·역할    | 10~30 행  |
| `Comments`                 | UOI별 코멘트        | 100~수백  |
| `Changelog`                | 모든 변경 기록      | 수백~수천 |
| `Snapshots`                | 확정본 스냅샷       | 36~       |
| `Constants_Themes`         | 6개 TDT (구/신)     | 6 행      |
| `Constants_KeyConcepts`    | 8개 Key Concepts    | 8 행      |
| `Constants_LearnerProfile` | 10개 학습자상       | 10 행     |
| `Constants_ATL`            | ATL 기능 카테고리   | 20~ 행    |
| `Constants_Curriculum2022` | 2022 개정 성취기준  | 수백 행   |

### 6.2 `Units` 시트 스키마 (핵심 테이블)

| 컬럼               | 타입     | 설명                                                  |
| ------------------ | -------- | ----------------------------------------------------- |
| `unit_id`          | string   | UUID, 기본키                                          |
| `grade`            | number   | 1~6                                                   |
| `theme_id`         | string   | TDT ID                                                |
| `title`            | string   | 선택적 제목                                           |
| `central_idea`     | string   | 중심 아이디어(진술문)                                 |
| `lines_of_inquiry` | JSON     | `["구1", "구2", "구3"]`                               |
| `key_concepts`     | JSON     | 최대 3개 ID 배열                                      |
| `related_concepts` | JSON     | 자유 태그 배열                                        |
| `learner_profile`  | JSON     | 복수 선택 ID                                          |
| `atl_skills`       | JSON     | 카테고리별 객체                                       |
| `action`           | string   | 실천 기회 서술                                        |
| `subject_links`    | JSON     | 교과·성취기준 코드 배열                               |
| `duration_weeks`   | number   | 기간(주)                                              |
| `notes`            | string   | 교사 메모                                             |
| `status`           | enum     | `draft`/`in_review`/`approved`/`finalized`/`archived` |
| `owner_email`      | string   | 담당 교사                                             |
| `created_at`       | datetime | 생성 시각                                             |
| `updated_at`       | datetime | 최종 수정 시각                                        |
| `updated_by`       | string   | 최종 수정자 이메일                                    |
| `version`          | number   | 낙관적 락 카운터                                      |
| `locked`           | boolean  | 확정 후 잠금 여부                                     |

### 6.3 `Users` 시트 스키마

| 컬럼             | 타입     | 설명                                                          |
| ---------------- | -------- | ------------------------------------------------------------- |
| `email`          | string   | Google 계정 (PK)                                              |
| `display_name`   | string   | 표시 이름                                                     |
| `role`           | enum     | `viewer`/`commenter`/`editor`/`approver`/`admin` (v3.1)       |
| `assigned_grade` | number   | 담당 학년 (optional)                                          |
| `subject_tags`   | JSON     | 담당 교과 태그 배열 — `["도덕","사회"]` 등 (멘션·필터용, v3.1) |
| `active`         | boolean  | 활성 여부                                                     |
| `added_at`       | datetime | 추가 시각                                                     |

> **마이그레이션**: 기존 `reviewer` 사용자는 `approver`로 자동 변환. `Comments` 권한이 필요한 동학년 동료는 `editor` 또는 `commenter`로 재배정.

### 6.4 `Changelog` 시트 스키마

| 컬럼           | 설명                                                  |
| -------------- | ----------------------------------------------------- |
| `change_id`    | UUID                                                  |
| `unit_id`      | 대상 UOI                                              |
| `timestamp`    | 변경 시각                                             |
| `actor_email`  | 변경자                                                |
| `action`       | `create`/`update`/`status_change`/`finalize`/`unlock`/`move`/`comment`/`react`/`resolve` (v3.1) |
| `field`        | 변경 필드명                                           |
| `before_value` | 이전 값 (JSON 문자열)                                 |
| `after_value`  | 이후 값 (JSON 문자열)                                 |
| `diff_summary` | 사람이 읽기 쉬운 요약                                 |

### 6.5 `Snapshots` 시트

확정 시점의 `Units` 행을 그대로 복제해 보관.

- 컬럼은 `Units`와 동일 + `snapshot_id`, `snapshot_at`, `snapshot_by`
- 감사·복원·학기말 보고용

### 6.6 `Comments` 시트 스키마 (v3.1 확장)

| 컬럼            | 타입     | 설명                                                                  |
| --------------- | -------- | --------------------------------------------------------------------- |
| `comment_id`    | string   | UUID, PK                                                              |
| `unit_id`       | string   | 대상 UOI                                                              |
| `parent_id`     | string   | 부모 댓글 ID (스레드용, null = 최상위) **신규**                       |
| `anchor_field`  | enum     | 댓글이 달린 필드 — `unit`(전체)/`central_idea`/`loi:0`~`loi:3`/`key_concepts`/`subject_links`/`action` **신규** |
| `author_email`  | string   | 작성자                                                                |
| `body`          | string   | 본문 (Markdown 허용, 최대 2000자)                                     |
| `mentions`      | JSON     | 멘션된 이메일 배열 — `["a@x","b@y"]` **신규**                         |
| `reactions`     | JSON     | `{"👍":["a@x"],"❤️":["b@y","c@z"]}` 이모지별 사용자 배열 **신규**     |
| `resolved`      | boolean  | 해결 상태 (Google Docs 스타일) **신규**                               |
| `resolved_by`   | string   | 해결 처리자 이메일 **신규**                                           |
| `resolved_at`   | datetime | 해결 시각 **신규**                                                    |
| `created_at`    | datetime | 작성 시각                                                             |
| `updated_at`    | datetime | 최종 수정 시각 **신규**                                               |
| `deleted`       | boolean  | 소프트 삭제 플래그 **신규**                                           |

> **확장 정책**: 댓글 본문 수정·삭제는 작성자 또는 `admin`만 가능. 삭제는 소프트 삭제(`deleted=true`)로 감사 추적 유지. 한 단원 댓글이 100개를 넘으면 `Comments_Archive_<연도>` 시트로 자동 분리.

---

## 7. GAS Web App API 명세

### 7.1 공통 규격

- **엔드포인트**: 한 GAS 프로젝트의 `doGet`/`doPost`가 `?action=` 쿼리로 라우팅
- **인증**: 모든 요청 헤더 `Authorization: Bearer <Google ID Token>`
- **응답 포맷**:
  ```json
  { "ok": true, "data": { ... } }
  { "ok": false, "error": { "code": "CONFLICT", "message": "..." } }
  ```
- **에러 코드**: `UNAUTHORIZED` / `FORBIDDEN` / `NOT_FOUND` / `CONFLICT` / `VALIDATION` / `LOCKED`

### 7.2 엔드포인트 전체 목록

| 메서드 | action         | 역할                    | 최소 권한                |
| ------ | -------------- | ----------------------- | ------------------------ |
| GET    | `meta`         | POI 메타 조회           | viewer                   |
| GET    | `units`        | 전체 UOI 목록           | viewer                   |
| GET    | `unit`         | 단일 UOI 상세           | viewer                   |
| GET    | `constants`    | 상수 테이블 조회        | viewer                   |
| GET    | `dashboard`    | 관리자 대시보드 집계    | admin                    |
| GET    | `changelog`    | 변경 이력               | viewer                   |
| GET    | `snapshots`    | 스냅샷 목록             | admin                    |
| GET    | `export`       | 내보내기 생성           | viewer(제한)/admin(전체) |
| POST   | `createUnit`   | UOI 생성                | editor                   |
| POST   | `updateUnit`   | UOI 수정 (version 체크) | editor (본인 학년)       |
| POST   | `submitReview` | 검토 요청               | editor                   |
| POST   | `approveUnit`  | 승인                    | reviewer/admin           |
| POST   | `rejectUnit`   | 반려                    | reviewer/admin           |
| POST   | `finalizeUnit` | 확정 + 스냅샷           | admin                    |
| POST   | `unlockUnit`   | 잠금 해제               | admin                    |
| POST   | `addComment`     | 코멘트 추가 (anchor_field/parent_id/mentions 지원) | **commenter** (v3.1) |
| POST   | `updateComment`  | 코멘트 본문 수정 (작성자 본인) **신규**            | commenter            |
| POST   | `deleteComment`  | 코멘트 소프트 삭제 (작성자 또는 admin) **신규**    | commenter            |
| POST   | `reactComment`   | 이모지 반응 토글 **신규**                          | commenter            |
| POST   | `resolveComment` | 해결 상태 토글 **신규**                            | commenter            |
| GET    | `comments`       | 단원별 댓글 목록 **신규**                          | viewer               |
| POST   | `moveUnit`       | UOI 학년·TDT 이동 (드래그) **신규** Phase 2-B      | editor (소유자) / admin |
| POST   | `updateUser`     | 사용자 권한 변경                                   | admin                |

### 7.3 `updateUnit` 처리 의사코드 (낙관적 락)

```
1. ID Token 검증 → 이메일 추출
2. Users 시트에서 이메일 조회, editor 이상 아니면 FORBIDDEN
3. 본인 학년 아니고 admin 아니면 FORBIDDEN
4. Units 시트에서 unit_id 행 찾기, 없으면 NOT_FOUND
5. locked == true면 LOCKED
6. 요청의 expected_version과 시트의 version 비교
   - 다르면 CONFLICT 반환 ("다른 사용자가 먼저 저장했습니다")
7. 검증 규칙 통과 못하면 VALIDATION
8. 변경 필드 업데이트, version += 1, updated_at/by 갱신
9. Changelog에 변경 내역 append
10. 성공 응답 (새 version 포함)
```

---

## 8. 권한 체계와 워크플로우

### 8.1 역할별 권한 (v3.1)

| 액션                       | viewer | commenter | editor | approver | admin |
| -------------------------- | ------ | --------- | ------ | -------- | ----- |
| 전체 POI 조회              | ✅     | ✅        | ✅     | ✅       | ✅    |
| 코멘트 작성·이모지 반응    | ❌     | ✅        | ✅     | ✅       | ✅    |
| 코멘트 해결 처리           | ❌     | ✅        | ✅     | ✅       | ✅    |
| UOI 편집 (본인 학년)       | ❌     | ❌        | ✅     | ❌       | ✅    |
| UOI 편집 (타 학년)         | ❌     | ❌        | ❌     | ❌       | ✅    |
| UOI 드래그 이동 (소유자)   | ❌     | ❌        | ✅     | ❌       | ✅    |
| UOI 드래그 이동 (타 학년)  | ❌     | ❌        | ❌     | ❌       | ✅    |
| 검토 요청                  | ❌     | ❌        | ✅     | ❌       | ✅    |
| 승인 / 반려                | ❌     | ❌        | ❌     | ✅       | ✅    |
| 확정 (finalize)            | ❌     | ❌        | ❌     | ❌       | ✅    |
| 잠금 해제                  | ❌     | ❌        | ❌     | ❌       | ✅    |
| 사용자 관리                | ❌     | ❌        | ❌     | ❌       | ✅    |
| 전체 내보내기              | 부분   | 부분      | 부분   | 부분     | ✅    |

> **핵심 변경**: `commenter` 역할 신설로 **편집 권한 없이 모든 단원에 피드백** 가능. `reviewer`는 `approver`로 개명되며 승인 권한만 보유. **피드백(누구나)과 승인(approver+)의 분리**가 v3.1 핵심.

### 8.1.1 드래그 이동 권한·검증 규칙 (v3.1, Phase 2-B)

**드래그 가능 조건** (모두 충족):
1. 단원 상태 ∈ `{draft, in_review}` (approved/finalized/archived는 자물쇠 표시)
2. `locked == false`
3. 작성자(`owner_email`) 본인이거나 `admin`
4. 해당 단원에 활성 충돌(다른 사용자가 편집 중인 미저장 변경)이 없어야 함

**drop 시점 3중 검증**:
- **TDT 균형**: 이동 후 해당 학년에 동일 `theme_id`가 2개 이상이면 ⚠️ 경고(저장은 허용, 학교 정책에 따라 차단도 가능)
- **학년군 정합성**: `subject_links`의 성취기준 코드가 새 학년의 학년군(3-4 또는 5-6)에 속하지 않으면 ⚠️ 경고 + 재매핑 유도
- **낙관적 락**: 클라이언트가 보유한 `version`과 서버 시점 `version`이 일치해야 함, 불일치 시 `CONFLICT` 반환

**기록**: Changelog `action: 'move'`, `before_value: {grade, theme_id, order}`, `after_value: {grade, theme_id, order}`

### 8.2 UOI 상태 전이도

```
                         revise
         ┌──────────────────────────────────┐
         │                                  │
         ▼        submit         approve    │    finalize
   ┌─────────┐   ──────▶   ┌──────────┐   ──────▶   ┌──────────┐   ──────▶   ┌───────────┐
   │  draft  │              │in_review │              │ approved │              │finalized🔒│
   └─────────┘   ◀──────   └──────────┘   ◀──────   └──────────┘   ◀──────   └───────────┘
                  reject                  revise                   unlock(admin)
                                                                                    │
                                                                                    ▼
                                                                               [archived]
```

- **draft**: 초안 작성 중, 담당 교사만 편집
- **in_review**: 검토 요청됨, 코멘트 단계
- **approved**: 승인됨, 확정 직전 대기
- **finalized**: 확정 + 잠금 + 스냅샷 저장, admin만 unlock 가능
- **archived**: 학기말 보관, 읽기 전용

### 8.3 동시 편집 충돌 UX

편집 시작 시 `version` 값 클라이언트 보관 → 저장 시 `expected_version` 전송 →
서버가 `CONFLICT` 반환 시 프론트:

> ⚠️ 이 UOI는 편집을 시작한 이후 **[김○○ 선생님]**이 수정했습니다.
>
> - [최신본 다시 불러오기] → 내 변경사항 포기
> - [비교 후 병합] → 두 버전 나란히 보기
> - [덮어쓰기] → 내 것으로 강제 저장 (⚠️ 주의)

---

## 9. 화면 사양

### 9.1 교사(일반) 페이지 — `index.html`

**홈 화면**

- 상단: 내 이름·역할·담당 학년 표시
- 중앙: 내 학년 UOI 카드 6개 (주제별, 상태 뱃지 + 완료율)
- 하단: 전체 POI 매트릭스 보기 링크 (읽기 전용 접근)
- "+" 버튼으로 신규 UOI 생성

**UOI 편집 화면**

- **좌(70%)**: 9개 요소 편집 폼 (섹션별 탭)
  1. 주제와 제목
  2. Central Idea
  3. Lines of Inquiry
  4. Key Concepts & Related
  5. Learner Profile & ATL
  6. Action
  7. 연계 교과 & 성취기준
  8. 기간 & 메모
  9. 검토·제출
- **우(30%)**: 탭 전환 패널 (v3.1)
  - **도움말 탭**: 현재 필드 가이드, Central Idea 예시, 선택한 Key Concept 핵심 질문
  - **댓글 탭** 💬: 단원 전체 댓글 + 필드별 앵커 댓글 (`anchor_field`) 스레드, 멘션·이모지·해결 토글
  - **이력 탭**: 변경 이력 타임라인
- **인라인 댓글 마커** (v3.1): 각 필드 우측에 💬 배지(미해결 댓글 수)·🔵 점(미열람) 표시, 클릭 시 우측 패널 댓글 탭으로 점프
- **하단**: [임시 저장] [검토 요청 제출] [취소]
- **실시간 검증**: 입력 즉시 물음표·개수·형식 체크

### 9.2 관리자(수석교사) 페이지 — `admin.html`

**대시보드 (첫 화면)**

- **상단 KPI 카드 4개**
  - 전체 UOI 수 / 확정 완료 / 검토 중 / 미착수
- **중앙 매트릭스** (v3.1: 드래그 지원)
  - 학년×주제 그리드, 카드형 UOI
  - 셀 색상: 회색=draft, 노랑=in_review, 파랑=approved, 초록=finalized
  - 셀 클릭 → UOI 상세
  - **드래그**: SortableJS 기반, 같은 셀 내 순서 변경 + 셀 간 이동 (학년·TDT 변경)
  - **잠금 카드**: approved/finalized/archived 또는 `locked=true`는 🔒 자물쇠 + 드래그 비활성
  - **드롭 검증 토스트**: ⚠️ TDT 균형 / ⚠️ 학년군 정합성 / ❌ 충돌 3종 즉시 피드백
  - **댓글 배지**: 카드 우상단 💬 N (미해결 댓글 수), 미열람 🔵 점
- **우측 활동 타임라인**
  - 최근 24시간 활동 피드 (누가 뭘 언제)
- **Key Concepts 균형 히트맵**
  - 8개 개념 × 학년 분포
  - 미출현 항목 자동 경고

**UOI 검토 페이지**

- **좌**: UOI 전체 내용 (읽기 전용 또는 편집 토글)
- **우**: 코멘트 스레드 + 변경 이력 타임라인
- **하단 액션**: [승인] [반려 + 이유] [확정] [관리자 편집]

**사용자 관리 페이지**

- Users 시트 편집 UI
- 이메일 추가·역할 변경·비활성화
- 학년 담당 배정

**내보내기 페이지**

- 대상 선택: 전체 / 학년별 / 상태별
- 형식 선택: PDF / Word / Markdown / JSON
- 생성 → Drive 임시 저장 → 다운로드 링크 반환

**스냅샷 관리**

- 스냅샷 목록 (시점별)
- 스냅샷 A vs B 비교 뷰
- 복원 기능

### 9.3 로그인 페이지 — `login.html`

- Google Sign-In 버튼
- 접근 권한 없는 이메일 로그인 시 안내 메시지
- 도움말 링크

---

## 10. 입력 검증 규칙

프론트 + GAS 이중 검증. 프론트는 UX용 즉시 피드백, GAS는 최종 신뢰 경계.

| 필드               | 규칙                                                           |
| ------------------ | -------------------------------------------------------------- |
| `central_idea`     | 최소 10자, 최대 200자, `?`로 끝나면 ⚠️ "진술문으로 작성하세요" |
| `lines_of_inquiry` | 배열 길이 3~4, 각 항목 5~150자, 물음표/물음 패턴 감지 시 ⚠️    |
| `key_concepts`     | 길이 1~3, 8개 ID 중 유효 ID만                                  |
| `related_concepts` | 길이 0~10, 각 태그 1~30자                                      |
| `learner_profile`  | 10개 ID 중 유효 ID만                                           |
| `theme_id`         | 6개 ID 중 하나                                                 |
| `duration_weeks`   | 1~12                                                           |
| `grade`            | 1~6                                                            |
| `subject_links`    | 성취기준 코드 유효성 (2022 개정 DB 대조)                       |

⚠️는 경고(저장은 가능), ❌는 차단.

---

## 11. 내보내기 사양

### 11.1 PDF (수석교사 실적 보고용)

- **1페이지**: POI 매트릭스 한 장 요약
- **2페이지~**: 학년별 UOI 상세 (각 UOI 한 페이지)
- **마지막**: Key Concepts 분포 차트 + 서명란
- 한글 폰트 임베드 (Pretendard)
- GAS에서 HTML → Google Docs → PDF 변환 경로 권장

### 11.2 Word (docx, 공문 첨부용)

- GAS Drive API로 Google Docs 생성 후 docx 내보내기
- 학교 공문 기본 서식 (한글 폰트, 들여쓰기 규정)
- 편집 가능 상태 유지 (수기 보완 위해)

### 11.3 Markdown (Obsidian 연동용)

- 전체 POI → 하나의 MD 파일 또는 UOI별 파일 모음 (zip)
- 프론트매터 포함 (tags, grade, theme 등)
- Obsidian PKM 볼트 `/1-Projects/IB-PYP-POI/` 경로 권장

### 11.4 JSON (백업·공유용)

- POI 전체 구조를 하나의 JSON으로
- 버전 표시 (schema version)
- 다른 학교·다음 학년도 템플릿으로 Import 가능

---

## 12. 기술 스택

### 12.1 프론트엔드

| 항목 | 선택                                     | 이유                                           |
| ---- | ---------------------------------------- | ---------------------------------------------- |
| 언어 | Vanilla HTML/CSS/JS                      | 빌드 툴 없음, GitHub Pages 직행, 유지보수 용이 |
| CSS  | 커스텀 + Tailwind CDN (선택)             | 가벼움                                         |
| 폰트 | Pretendard                               | 한글 가독성, 무료                              |
| 인증 | Google Identity Services (GIS)           | 학교 Gmail 호환                                |
| 차트 | Chart.js                                 | 히트맵·막대 차트 간편                          |
| PDF  | html2pdf.js (프론트) 또는 GAS Drive 경로 | 한글 대응 우선                                 |

### 12.2 백엔드

| 항목      | 선택                                                           | 이유                              |
| --------- | -------------------------------------------------------------- | --------------------------------- |
| 플랫폼    | Google Apps Script                                             | Sheets 직접 접근, 무료, 배포 간편 |
| 개발 도구 | `clasp` (Google CLI)                                           | 로컬 VSCode 개발 가능             |
| 배포      | GAS Web App `Execute as: Me, Who has access: Anyone with link` | 공개 엔드포인트 + 토큰 검증       |

### 12.3 데이터 저장

| 항목  | 선택                                 |
| ----- | ------------------------------------ |
| 주 DB | Google Sheets                        |
| 백업  | JSON 내보내기 (수동 또는 주간 자동)  |
| 캐시  | GAS `CacheService` (대시보드 집계용) |

### 12.4 배포·운영

| 항목          | 선택                                         |
| ------------- | -------------------------------------------- |
| 프론트 호스팅 | GitHub Pages                                 |
| 버전 관리     | Git                                          |
| CI/CD         | GitHub Actions (선택적, `clasp push` 자동화) |
| 모니터링      | GAS 실행 로그 + `Logger`                     |

---

## 13. 폴더 구조

```
poi-builder/
├── README.md
├── LICENSE
├── index.html                  # 교사용 메인 페이지
├── admin.html                  # 수석교사용 관리자 페이지
├── login.html                  # 로그인 페이지
├── css/
│   ├── base.css
│   ├── matrix.css
│   ├── editor.css
│   └── admin.css
├── js/
│   ├── main.js                 # 교사 페이지 엔트리
│   ├── admin.js                # 관리자 페이지 엔트리
│   ├── auth.js                 # Google Sign-In 래퍼
│   ├── api.js                  # GAS 호출 공통 래퍼
│   ├── matrix-view.js          # 매트릭스 렌더링
│   ├── uoi-editor.js           # UOI 편집 폼
│   ├── dashboard.js            # 관리자 대시보드
│   ├── export-ui.js            # 내보내기 UI
│   ├── validators.js           # 입력 검증
│   └── utils.js
├── assets/
│   ├── icons/                  # 8개 Key Concept 아이콘 SVG
│   └── fonts/                  # Pretendard subset
├── gas/                        # clasp 관리 대상 (별도 GAS 프로젝트)
│   ├── .clasp.json
│   ├── appsscript.json
│   ├── main.js                 # doGet/doPost 라우터
│   ├── auth.js                 # 토큰 검증, 권한 체크
│   ├── units.js                # UOI CRUD
│   ├── workflow.js             # 상태 전이 로직
│   ├── export.js               # 내보내기 생성
│   ├── changelog.js            # 변경 이력
│   ├── users.js                # 사용자 관리
│   └── utils.js
├── docs/
│   ├── user-manual.md          # 교사용 매뉴얼
│   ├── admin-manual.md         # 수석교사용 매뉴얼
│   ├── sheets-schema.md        # DB 스키마 문서
│   └── api-reference.md        # GAS API 문서
└── scripts/
    └── seed-constants.js       # 상수 시트 초기화 스크립트
```

---

## 14. 개발 로드맵

총 **9주** 예정. 각 Phase 종료 시 남부초 교사 검증.

### Phase 0 — 기반 구축 (1주)

**목표**: 인프라 세팅, 상수 데이터 준비

- [ ] GitHub 저장소 `plusiam/poi-builder` 생성
- [ ] Google Spreadsheet 생성 + 11개 시트 스키마 작성
- [ ] 상수 시트 데이터 입력
  - Constants_Themes (구/신 기술어)
  - Constants_KeyConcepts (8개)
  - Constants_LearnerProfile (10개)
  - Constants_ATL (5 카테고리 × 세부)
- [ ] GAS 프로젝트 생성 → Spreadsheet 바인딩
- [ ] `clasp` 로컬 개발 환경 설정
- [ ] Google Cloud Console에서 OAuth 2.0 클라이언트 ID 발급

**완료 기준**: `clasp push`로 GAS에 "Hello World" 엔드포인트 배포, 브라우저에서 호출 성공.

---

### Phase 1 — 인증 · 읽기/쓰기 MVP (2주)

**목표**: 한 교사가 UOI를 만들고 다른 브라우저에서 확인할 수 있음

- [ ] 프론트: Google Sign-In 통합, 토큰 저장
- [ ] GAS: ID Token 검증 함수
- [ ] GAS: `doGet`/`doPost` 라우팅
- [ ] GAS 엔드포인트: `meta`, `units`, `unit`, `constants`
- [ ] GAS 엔드포인트: `createUnit`, `updateUnit` (낙관적 락 포함)
- [ ] Users 시트 기반 권한 체크
- [ ] 프론트: 매트릭스 뷰 (읽기 전용)
- [ ] 프론트: UOI 편집 폼 (9요소 중 핵심 5개: theme, central idea, LOI, key concepts, 연계 교과)
- [ ] 충돌 감지 UX

**완료 기준**: 교사 A가 UOI 2개 생성·저장, 교사 B가 다른 브라우저로 로그인해 즉시 확인 가능.

---

### Phase 2 — 워크플로우 + 협업 확장 (3주, v3.1 확장)

**목표**: 초안 → 팀 피드백 → 승인 → 확정 전 경로 동작 + UOI 드래그 재배치

#### Phase 2-Core — 상태 전이·관리자 뷰 (1주)

- [ ] 상태 전이 엔드포인트 (`submitReview`, `approveUnit`, `rejectUnit`, `finalizeUnit`, `unlockUnit`)
- [ ] Changelog 전 엔드포인트 적용
- [ ] 관리자 대시보드 (KPI + 매트릭스 + 활동 피드)
- [ ] Key Concepts 균형 히트맵
- [ ] Snapshots 시트 자동 생성 (finalize 시)
- [ ] 잠금 해제 기능

#### Phase 2-A — 팀 피드백 댓글 시스템 (1주, v3.1 신규)

> **합의 배경**: IB Collaborative Planning 정신에 부합. 수석 단독 검토 병목 해소, 교과별 전문가 피드백 활성화.

- [ ] **역할 모델 확장**: `Users.role` enum에 `commenter` 추가, 기존 `reviewer` → `approver` 마이그레이션 스크립트
- [ ] **Comments 시트 스키마 확장**: `parent_id`, `anchor_field`, `mentions`, `reactions`, `resolved`, `resolved_by`, `resolved_at`, `updated_at`, `deleted` 컬럼 추가
- [ ] **GAS 엔드포인트**: `addComment`(확장), `updateComment`, `deleteComment`, `reactComment`, `resolveComment`, `comments`(GET)
- [ ] **권한 매트릭스 갱신**: [`gas/users.js`](../gas/users.js)의 `requireRole_` 호출에 `commenter` 등급 반영
- [ ] **프론트 댓글 패널**: [`js/uoi-editor.js`](../js/uoi-editor.js) 우측 탭에 댓글 스레드, 멘션 자동완성(@email), 이모지 반응 토글, 해결 처리
- [ ] **인라인 앵커 댓글**: 각 필드(central_idea, loi:N, key_concepts, subject_links, action) 옆 💬 배지 + 클릭 점프
- [ ] **알림**: 자기 단원 댓글/멘션 발생 시 매트릭스 카드 배지 + 선택적 메일(GAS `MailApp`)
- [ ] **잠금 정책**: `finalized` 단원은 일반 댓글 잠금, 별도 '회고 댓글' 모드만 활성

**완료 기준**: 동학년 동료·전담교사·코디네이터가 한 UOI에 각각 댓글·멘션·이모지 반응을 달고, PYP 코디네이터가 ✅ Resolve 처리 → 작성자가 알림 받고 수정 → 모든 이력이 Changelog와 Comments에 기록됨.

#### Phase 2-B — UOI 드래그 재배치 (1주, v3.1 신규)

> **합의 배경**: POI 설계는 본질적으로 재배치 작업. 포스트잇 워크숍 메타포와 일치.

- [ ] **SortableJS 도입**: [`js/lib/Sortable.min.js`](../js/lib/) (vanilla, 의존성 없음, ~6KB gzip)
- [ ] **MatrixView 확장**: [`js/matrix-view.js`](../js/matrix-view.js) 셀에 `data-unit-id`, `data-version`, `data-locked`, `data-owner` 속성 부여, `Sortable` 인스턴스 셀별 생성, `group: 'units'` 공유
- [ ] **드래그 권한 가드** (프론트): 잠금 카드 비활성화(`filter`), 본인 소유 + 상태 검증, 시각적 자물쇠 표시
- [ ] **GAS `moveUnit` API**: `POST {unit_id, new_grade, new_theme_id, new_order, expected_version}` → 권한 + 잠금 + version + 균형 + 학년군 5중 검증
- [ ] **검증 결과 UX**: drop 시점 토스트(✅ 성공 / ⚠️ 균형/정합성 경고 / ❌ CONFLICT)
- [ ] **롤백**: 서버 거부 시 SortableJS `onEnd`에서 원위치 애니메이션
- [ ] **Changelog**: `action: 'move'`, `before/after` JSON에 `{grade, theme_id, order}` 기록
- [ ] **순서 보존**: `Units` 시트에 `display_order` 컬럼 추가(같은 grade×theme 내 정렬용)

**완료 기준**: 매트릭스에서 한 UOI를 다른 학년·TDT로 드래그 → 검증 통과 시 즉시 시트 반영 + 모든 사용자 매트릭스에 즉시 반영(다음 새로고침), 학년군 불일치 시 경고 배지 표시 후 재매핑 유도.

#### Phase 2-C (선택) — 알림·필터 고도화 (0.5주)

- [ ] 미해결 댓글 카운터 대시보드 위젯
- [ ] 멘션 발생 시 메일 발송(opt-in)
- [ ] 매트릭스 필터: '내가 멘션된', '미해결 댓글 있는', '드래그 잠금된'

**완료 기준**: 한 UOI가 draft → in_review(팀 피드백) → approved → finalized 전체 경로를 거치며, 모든 단계 이력이 Changelog·Comments에 남고, 매트릭스에서 자유롭게 재배치 가능.

---

### Phase 3 — 내보내기 · 교육과정 통합 (2주)

**목표**: 수석교사가 확정본을 공문용으로 출력 가능

- [ ] Constants_Curriculum2022 시트 구축
  - 우선순위: 도덕 3~6학년 → 사회 3~6학년 → 과학 3~6학년
- [ ] UOI 편집 폼의 성취기준 매퍼 UI
- [ ] Markdown 내보내기 (GAS)
- [ ] JSON 백업 내보내기 (GAS)
- [ ] PDF 내보내기 (HTML → Google Docs → PDF 경로)
- [ ] Word(docx) 내보내기
- [ ] 관리자 페이지 내보내기 화면
- [ ] 남부초 3~6학년 실데이터 입력

**완료 기준**: 수석교사가 2026학년도 POI를 PDF·Word·Markdown 3가지로 다운로드 가능.

---

### Phase 4 — 관리자 고급 기능 · 운영 (2주)

**목표**: 실사용에 필요한 주변 기능 완성

- [ ] 사용자 관리 UI
- [ ] 스냅샷 비교 뷰
- [ ] 학기/연도 단위 아카이브 기능
- [ ] 구/신 기술어 토글 기능
- [ ] 성능 최적화 (대시보드 캐싱, Sheets 읽기 최소화)
- [ ] 사용자 매뉴얼 작성 (교사용 + 관리자용)
- [ ] 스크린캐스트 (5분짜리 튜토리얼)
- [ ] 버그 수정 및 접근성 점검

**완료 기준**: 수벤저스·수품책 연구회 등 외부 교사에게 공유 가능한 수준의 완성도.

---

### Phase 5 (선택) — 확장 기능

- AI 보조 (Gemini API로 Central Idea 초안 생성)
- ILP(Inquiry Learning Progressions) 연동
- 슬랙/디스코드 알림 (GAS → Webhook)
- 학교 간 POI 벤치마킹 공개 모드
- IB 공식 docx 템플릿 매칭

---

## 15. 리스크 매트릭스

| #   | 리스크                                  | 영향도 | 가능성 | 대응 전략                                                                         |
| --- | --------------------------------------- | ------ | ------ | --------------------------------------------------------------------------------- |
| R1  | GAS 실행 시간 한도(6분) 초과            | 중     | 낮음   | 대용량 내보내기는 비동기 작업으로 분할, `TriggerService` 활용                     |
| R2  | GAS 일 할당량 초과                      | 중     | 낮음   | 대시보드 캐싱, 불필요한 Sheets 읽기 제거, `CacheService` 적극 사용                |
| R3  | 동시 편집 충돌로 데이터 유실            | 높음   | 중     | 낙관적 락 + Changelog 전부 기록 → 언제든 복구 가능                                |
| R4  | Sheets 파일 직접 수정으로 정합성 깨짐   | 중     | 중     | 편집 권한을 수석교사 + 학년부장만, `onEdit` 트리거로 version/updated_at 자동 갱신 |
| R5  | 학교 Google 도메인 정책으로 로그인 실패 | 높음   | 낮음   | 개인 Gmail 허용, Users 시트 유연 운영                                             |
| R6  | GitHub Pages ↔ GAS CORS 문제            | 중     | 낮음   | GAS 응답에 `Access-Control-Allow-Origin: *` (공개 API) 또는 도메인 제한           |
| R7  | 한글 docx/PDF 폰트 깨짐                 | 중     | 중     | Pretendard 웹폰트 임베드, Google Docs 경유 변환                                   |
| R8  | 수석교사 퇴임 시 GAS/Sheets 소유권      | 높음   | 낮음   | 학교 공용 Google 계정으로 소유자 지정, 문서화                                     |
| R9  | IB 공식 용어 번역 표준 미확정           | 낮음   | 중     | 한·영 병기, 사용자 설정으로 커스터마이즈 허용                                     |
| R10 | 2022 개정 성취기준 DB 구축 공수         | 중     | 높음   | Phase 3로 분리, 도덕 전학년만 먼저                                                |
| R11 | 교사 학습 곡선                          | 중     | 중     | 5분 스크린캐스트 + 인라인 도움말 풍부하게                                         |
| R12 | 댓글 폭발로 Comments 시트 행 한계 도달  | 중     | 중     | 학년도별 `Comments_Archive_<연도>` 자동 분리, 미해결만 활성 시트 유지 (v3.1)      |
| R13 | 드래그 후 학년군 성취기준 무효화        | 높음   | 중     | drop 시점 학년군 검증 + ⚠️ 경고 배지로 재매핑 유도, Changelog `move` 기록 (v3.1) |
| R14 | 멘션 알림 메일 스팸·할당량 초과         | 중     | 중     | 사용자별 opt-in 토글, 시간당 발송 빈도 제한 (v3.1)                                |
| R15 | 권한 마이그레이션(reviewer→approver) 누락 | 중   | 낮음   | Phase 2-A 시작 시 일회성 마이그레이션 스크립트 + 검증 리포트 (v3.1)               |

---

## 16. 품질·운영 기준

### 16.1 접근성

- 키보드 네비게이션 전 지원 (Tab/화살표로 매트릭스 이동)
- 색각 이상 대응: 8개 Key Concepts는 색 + 아이콘 동시 사용
- 스크린 리더 테스트 (NVDA 기본)
- 모든 입력 필드에 한글 placeholder와 도움말

### 16.2 보안

- **모든 GAS 엔드포인트에서 ID Token 검증 필수**
- Users 시트 화이트리스트 외 접근 전부 거부
- Sheets 파일 편집 권한 최소화 (수석교사 + 2명)
- HTTPS 전용 (GitHub Pages 기본)
- 민감 정보(API 키, OAuth Secret)는 GAS `PropertiesService`에만 저장

### 16.3 코드 품질

- **한글 주석 필수** (사용자 preference)
- 함수당 50줄 이내, 단일 책임
- 매직 넘버는 상수로 분리
- GAS 함수 입력 검증 철저
- 커밋 메시지 한글 허용, Conventional Commits 권장

### 16.4 파괴적 액션 UX

- 삭제, finalize, unlock은 반드시 확인 모달
- 확정/잠금 해제는 사유 입력 필수
- Changelog에 모든 파괴적 액션 영구 기록

### 16.5 성능 목표

- 매트릭스 첫 로드: 2초 이내
- UOI 저장 응답: 1.5초 이내
- 대시보드 캐시 적중 시: 500ms 이내
- PDF 생성: 10초 이내 (학년 하나)

---

## 부록 A: 상수 데이터

### A.1 `Constants_Themes` 시트 샘플 (일부)

| id                   | name_ko         | name_en            | old_descriptor                            | new_statement                      | new_bullet_1                    | new_bullet_2                     | new_bullet_3             |
| -------------------- | --------------- | ------------------ | ----------------------------------------- | ---------------------------------- | ------------------------------- | -------------------------------- | ------------------------ |
| `who_we_are`         | 우리는 누구인가 | Who we are         | 자아, 신념, 건강, 인간 관계, 권리·책임... | 개인 및 집단으로서의 정체성 탐구   | 신체·정서·사회·영적 건강과 웰빙 | 관계와 소속감                    | 배움과 성장              |
| `sharing_the_planet` | 지구를 공유하기 | Sharing the planet | 유한한 자원 공유, 권리·책임, 평화와 갈등  | 인간과 자연 세계의 상호의존성 탐구 | 모든 존재의 권리·책임·존엄      | 정의·평화·재구상된 미래로의 경로 | 자연, 복잡성, 공존, 지혜 |
| ...                  | ...             | ...                | ...                                       | ...                                | ...                             | ...                              | ...                      |

### A.2 `Constants_KeyConcepts` 시트

| id               | name_ko | name_en        | key_question_ko         | key_question_en                      | description_ko                                          |
| ---------------- | ------- | -------------- | ----------------------- | ------------------------------------ | ------------------------------------------------------- |
| `form`           | 형태    | Form           | 어떻게 생겼는가?        | What is it like?                     | 모든 것은 관찰·식별·분류 가능한 형태를 가짐             |
| `function`       | 기능    | Function       | 어떻게 작동하는가?      | How does it work?                    | 모든 것은 탐구 가능한 목적·역할·작동 방식을 가짐        |
| `causation`      | 원인    | Causation      | 왜 그러한가?            | Why is it like it is?                | 모든 일은 인과 관계 속에서 일어나며, 행동은 결과를 낳음 |
| `change`         | 변화    | Change         | 어떻게 변하는가?        | How is it changing?                  | 변화는 한 상태에서 다른 상태로의 움직임 과정            |
| `connection`     | 연결    | Connection     | 무엇과 연결되는가?      | How is it connected to other things? | 모든 것은 서로 연결되어 있음                            |
| `perspective`    | 관점    | Perspective    | 어떤 관점들이 있는가?   | What are the points of view?         | 지식은 관점에 따라 조정됨                               |
| `responsibility` | 책임    | Responsibility | 우리의 책임은 무엇인가? | What is our responsibility?          | 이해를 바탕으로 한 선택과 실천                          |
| `reflection`     | 성찰    | Reflection     | 어떻게 알게 되는가?     | How do we know?                      | 어떻게 알게 되었는가, 어떤 증거가 있는가                |

### A.3 `Constants_LearnerProfile` 시트

10개 학습자상: Inquirer / Knowledgeable / Thinker / Communicator / Principled / Open-minded / Caring / Risk-taker / Balanced / Reflective

### A.4 `Constants_ATL` 시트 (5 카테고리)

1. Thinking Skills (사고 기능)
2. Communication Skills (소통 기능)
3. Social Skills (사회 기능)
4. Self-management Skills (자기관리 기능)
5. Research Skills (연구 기능)

### A.5 `Constants_Curriculum2022` 시트 구조

| subject | grade_group | code       | statement                                    |
| ------- | ----------- | ---------- | -------------------------------------------- |
| 도덕    | 3-4         | [4도01-01] | 도덕 시간에 무엇을 배울지 이야기해 보고, ... |
| 도덕    | 5-6         | [6도01-01] | 자신의 특징을 이해하고 ...                   |
| 사회    | 3-4         | [4사01-01] | ...                                          |
| ...     | ...         | ...        | ...                                          |

---

## 다음 단계 (Phase 0 착수 체크리스트)

1. ☐ GitHub 저장소 생성
2. ☐ Google Spreadsheet 생성 (소유자: 학교 공용 계정 고려)
3. ☐ 11개 시트 스키마 세팅
4. ☐ 상수 데이터 입력 (우선 Themes, KeyConcepts, LearnerProfile, ATL)
5. ☐ GAS 프로젝트 생성 + Spreadsheet 바인딩
6. ☐ `clasp` 설치 및 프로젝트 연결
7. ☐ Google Cloud Console OAuth 클라이언트 ID 발급
8. ☐ 기본 README.md 작성 (프로젝트 소개 + 기여 가이드)

---

_이 문서는 최종 통합 개발 계획서입니다. Phase 1 착수 전 수석교사(여한기) 최종 검토 후 확정합니다._

_변경 이력:_

- _v1.0 (2026-04-18): 초기 단일 사용자 버전_
- _v2.0 (2026-04-18): 전문가 팀 협의 — GitHub Pages + GAS + Sheets 협업 구조 도입_
- _v3.0 (2026-04-18): 최종 통합 — v1 도메인 지식 + v2 협업 아키텍처 병합_
- _v3.1 (2026-04-27): IB 전문가 팀 라운드테이블 — (1) UOI 드래그 재배치 (Phase 2-B), (2) `commenter` 역할 신설 + 팀원 전체 피드백 (Phase 2-A), (3) `reviewer`→`approver` 개명, (4) Comments 스키마 확장(parent_id·anchor_field·mentions·reactions·resolved), (5) Changelog action 확장(move/comment/react/resolve), (6) Phase 2 1주 → 3주 확장_
- _v3.2 (2026-04-28): Phase 2-B UOI 드래그 재배치 구현 완료 — SortableJS 도입, `Units.display_order` 컬럼 추가(`migrate_v3_2()`), `moveUnit` GAS API + 5중 검증(권한·잠금·낙관적락·TDT 균형·학년군 정합성), 매트릭스 셀 단위 Sortable 인스턴스, 자물쇠 배지·고스트 스타일, `Snapshots`도 `display_order` 컬럼 추가_
