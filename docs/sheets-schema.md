# POI Builder — Google Sheets 스키마 (v3.1)

> **단일 진실의 원천(Single Source of Truth)** 으로서의 Google Sheets 구조와 v3.0 → v3.1 변경 내역을 기술한다.
> 코드 진실(authoritative): [gas/setup.js](../gas/setup.js)의 `setupSheets_` / `migrate_v3_1` 함수.
> 본 문서는 그것의 사람용 사양서.

| 항목 | 값 |
| ---- | ---- |
| 문서 버전 | 1.2 (v3.3 스키마 시점) |
| 최종 갱신 | 2026-04-28 |
| 적용 GAS 버전 | Phase 2-A/B + Phase 4 (댓글 / 드래그 / 학년도 롤오버 / 인쇄 / 휴지통) |
| 마이그레이션 함수 | `migrate_v3_1()` → `migrate_v3_2()` → `migrate_v3_3()` (각각 실데이터 보존) |
| 풀 셋업 함수 | `setupAll()` / `setupStandalone()` (신규 환경 전용 — 기존 데이터 삭제됨) |

---

## 1. 시트 전체 목록

| 시트명                       | 역할                          | 예상 규모 | v3.1 변경 |
| ---------------------------- | ----------------------------- | --------- | --------- |
| `POI_Meta`                   | 학교·연도·버전 메타           | 1~수 행   | -         |
| `Units`                      | UOI 본체                      | 36~72 행  | **v3.2: `display_order` / v3.3: `deleted`·`deleted_at`·`deleted_by`** |
| `Users`                      | 이메일·이름·역할              | 10~30 행  | **`subject_tags` 추가, role enum 확장** |
| `Comments`                   | UOI별 댓글 (스레드·앵커·반응) | 100~수천  | **9개 컬럼 신규 추가, 스키마 재구성** |
| `Changelog`                  | 모든 변경 기록                | 수백~수천 | **`action` enum 확장 (move/comment/react/resolve/mention)** |
| `Snapshots`                  | 확정본 스냅샷                 | 36~       | **v3.2: `display_order` 추가** |
| `Constants_Themes`           | 6개 TDT (구/신)               | 6 행      | -         |
| `Constants_KeyConcepts`      | 8개 Key Concepts              | 8 행      | -         |
| `Constants_LearnerProfile`   | 10개 학습자상                 | 10 행     | -         |
| `Constants_ATL`              | ATL 기능 카테고리             | 14~20 행  | -         |
| `Constants_Curriculum2022`   | 2022 개정 성취기준            | 수백 행   | -         |

---

## 2. v3.0 → v3.1 변경 요약

### 2.1 변경 시트
- **`Users`** — `subject_tags` 컬럼 신설(JSON 배열), `role` enum에 `commenter`/`approver` 추가
- **`Comments`** — 5개 → 14개 컬럼으로 확장, 스레드·앵커·멘션·이모지 반응·해결 상태 지원
- **`Changelog`** — 컬럼 변경 없음, `action` enum만 확장

### 2.2 마이그레이션 시퀀스 (실데이터 환경)

```
1. Apps Script 에디터에서 migrate_v3_1() 실행
   ├─ migrateUsers_v3_1_()
   │   ├─ active 컬럼 앞에 subject_tags 컬럼 삽입
   │   └─ role == 'reviewer' 행을 'approver'로 일괄 변환
   └─ migrateComments_v3_1_()
       ├─ 기존 5컬럼 헤더 감지
       ├─ 기존 행 백업 후 시트 클리어
       └─ 14컬럼 신규 헤더로 재기록 (anchor_field='unit', mentions/reactions 기본값)
```

> **롤백**: 마이그레이션 직전 시트 복사본을 따로 보관할 것. v3.1은 컬럼 추가형 변경이므로 복사본 → 시트명 교체로 복구 가능.

### 2.3 신규 환경

`setupAll()` 또는 `setupStandalone()`을 실행하면 v3.1 스키마로 바로 생성된다. 기존 데이터는 `clearContents`로 모두 삭제됨에 유의.

---

## 3. 시트별 상세 스키마

### 3.1 `POI_Meta`

학교 단위 메타. 1행만 사용하는 게 일반적.

| 컬럼 | 타입 | 예시 |
| ---- | ---- | ---- |
| `school_name` | string | `대구 남부초` |
| `year` | string | `2026` |
| `version` | string | `1.0` |
| `created_at` | datetime ISO | `2026-04-18T10:00:00.000Z` |
| `updated_at` | datetime ISO | - |
| `notes` | string | `POI Builder 초기 설정` |

### 3.2 `Units` (핵심 테이블)

| 컬럼 | 타입 | 비고 |
| ---- | ---- | ---- |
| `unit_id` | UUID v4 | PK |
| `grade` | number | 1~6 |
| `theme_id` | enum | `who_we_are` / `where_we_are_in_place_and_time` / `how_we_express_ourselves` / `how_the_world_works` / `how_we_organize_ourselves` / `sharing_the_planet` |
| `title` | string | 선택 |
| `central_idea` | string | 10~200자 |
| `lines_of_inquiry` | JSON `string[]` | 3~4개, 각 5~150자 |
| `key_concepts` | JSON `string[]` | 최대 3개, KeyConcepts ID |
| `related_concepts` | JSON `string[]` | 0~10 태그 |
| `learner_profile` | JSON `string[]` | 학습자상 ID |
| `atl_skills` | JSON `object` | 카테고리별 객체 |
| `action` | string | 자유 서술 |
| `subject_links` | JSON `string[]` | `[4도01-01]` 같은 성취기준 코드 |
| `duration_weeks` | number | 1~12 |
| `notes` | string | 교사 메모 |
| `status` | enum | `draft` / `in_review` / `approved` / `finalized` / `archived` |
| `owner_email` | string | 담당 교사 |
| `created_at` | datetime ISO | - |
| `updated_at` | datetime ISO | - |
| `updated_by` | string | 최종 수정자 이메일 |
| `version` | number | 낙관적 락 카운터 (수정마다 +1) |
| `locked` | boolean | 확정 후 잠금 여부 |

> **v3.2 추가** (Phase 2-B 완료): `display_order` (number) 컬럼 — 같은 `(grade, theme_id)` 내 카드 순서. 드래그 정렬 시 0,1,2... 로 정규화. 마이그레이션 시 기존 단원에 `created_at` 순서로 자동 부여.
>
> **v3.3 추가** (Phase 4 후속, 휴지통):
> - `deleted` (boolean) — 휴지통 플래그. 기본 조회는 `deleted!==true`만 노출.
> - `deleted_at` (datetime ISO) — 삭제(휴지통 이동) 시각.
> - `deleted_by` (string) — 삭제자 이메일.
> - 영구 삭제 시 행 자체가 사라지므로 위 3개 컬럼은 의미 없어짐 — Snapshots와 Changelog에 흔적이 남음.

### 3.3 `Users` (v3.1 변경)

| 컬럼 | 타입 | 비고 |
| ---- | ---- | ---- |
| `email` | string | PK, Google 계정 |
| `display_name` | string | UI 표시 이름 |
| `role` | enum | **v3.1**: `viewer` / `commenter` / `editor` / `approver` / `admin` (기존 `reviewer`는 `approver`로 자동 매핑됨) |
| `assigned_grade` | number | 담당 학년 (선택) |
| `subject_tags` | JSON `string[]` | **v3.1 신규** — `["도덕","사회"]` 같은 담당 교과 태그. 멘션·필터·교과별 검토 매칭에 활용 |
| `active` | boolean | 활성 여부 (false면 인증 거부) |
| `added_at` | datetime ISO | 추가 시각 |

**역할 의미**:
- `viewer` — 조회만
- `commenter` — 조회 + 댓글·이모지·해결 처리 (편집 불가)
- `editor` — 본인 학년 UOI 편집 + 모든 댓글
- `approver` — 승인·반려 (구 `reviewer`)
- `admin` — 모든 권한 (확정·잠금 해제·사용자 관리)

**호환성**: [gas/auth.js](../gas/auth.js)의 `ROLE_ALIASES`가 `reviewer` → `approver`를 자동 매핑하므로 마이그레이션 누락 시에도 권한 체크는 정상 동작. 단, 시트 표시값은 `migrate_v3_1()` 실행 시 일괄 변환된다.

### 3.4 `Comments` (v3.1 대폭 확장)

| 컬럼 | 타입 | 신규 | 비고 |
| ---- | ---- | :--: | ---- |
| `comment_id` | UUID v4 | | PK |
| `unit_id` | string | | FK → `Units.unit_id` |
| `parent_id` | string \| '' | ✅ | 부모 댓글 ID (스레드 1뎁스), 빈 문자열 = 최상위 |
| `anchor_field` | enum | ✅ | `unit` / `central_idea` / `loi:0`~`loi:3` / `key_concepts` / `subject_links` / `action` / `retro` |
| `author_email` | string | | 작성자 |
| `body` | string | | 본문 (Markdown 일부 허용, 최대 2000자) |
| `mentions` | JSON `string[]` | ✅ | 멘션된 이메일, 형식 검증됨 |
| `reactions` | JSON `object` | ✅ | `{"👍":["a@x"],"❤️":["b@y"]}` 이모지 → 사용자 배열. 허용 이모지 6개: `👍 ❤️ 🤔 🎉 👀 ✅` |
| `resolved` | boolean | ✅ | 해결 상태 (Google Docs 스타일) |
| `resolved_by` | string | ✅ | 해결 처리자 이메일 |
| `resolved_at` | datetime ISO | ✅ | 해결 시각 |
| `created_at` | datetime ISO | | 작성 시각 |
| `updated_at` | datetime ISO | ✅ | 최종 수정/반응/해결 변경 시각 |
| `deleted` | boolean | ✅ | 소프트 삭제 (감사 추적 유지) |

**제약**:
- `body` 빈 문자열 또는 공백만은 거부 (`VALIDATION`)
- `body` 길이 > 2000 거부
- `parent_id`가 가리키는 댓글이 다른 `unit_id`에 속하면 거부
- `finalized` 상태 단원: `anchor_field='retro'` 외 일반 댓글 차단
- `archived` 상태 단원: 모든 신규 댓글 차단
- 본문 수정·삭제: `author_email == email` 또는 역할 `admin`만 가능

**감사 추적**: 모든 작성/수정/삭제/이모지/해결 액션은 `Changelog`에 대응 행을 남긴다 (아래 3.5 참조). 따라서 `Comments.deleted=true`라도 누가 언제 무엇을 적었다 지웠는지 복원 가능.

### 3.5 `Changelog` (v3.1 enum 확장)

| 컬럼 | 타입 | 비고 |
| ---- | ---- | ---- |
| `change_id` | UUID v4 | PK |
| `unit_id` | string | FK |
| `timestamp` | datetime ISO | - |
| `actor_email` | string | 행위자 |
| `action` | enum | 아래 표 참조 |
| `field` | string | 변경된 필드 또는 anchor (`central_idea`, `loi:1`, `unit`, `mentions` 등) |
| `before_value` | string (JSON 가능) | 이전 값 |
| `after_value` | string (JSON 가능) | 이후 값 (또는 신규 ID) |
| `diff_summary` | string | 사람이 읽기 쉬운 요약 |

**`action` enum 전체 목록**:

| action | 발생 시점 | v3.1 신규 |
| ------ | --------- | :--: |
| `create` | UOI 생성 | |
| `update` | UOI 필드 수정 | |
| `status_change` | 상태 전이 (submit/approve/reject/finalize/unlock) | |
| `finalize` | 확정 | |
| `unlock` | 잠금 해제 | |
| `move` | UOI 학년·TDT·순서 변경 (드래그) | ✅ Phase 2-B |
| `comment` | 댓글 작성·삭제 | ✅ Phase 2-A |
| `react` | 이모지 반응 토글 | ✅ Phase 2-A |
| `resolve` | 댓글 해결 토글 | ✅ Phase 2-A |
| `mention` | 멘션 발생 (per 멘션 1행) | ✅ Phase 2-A |
| `archive` | 학년도 롤오버 (일괄 아카이브) | ✅ Phase 4 |
| `delete`  | 휴지통으로 이동 (소프트 삭제) | ✅ v3.3 |
| `restore` | 휴지통에서 복원 | ✅ v3.3 |
| `purge`   | 영구 삭제 (admin only, Units 행 제거) | ✅ v3.3 |

### 3.6 `Snapshots`

`Units` 컬럼 전체 + `snapshot_id` (UUID), `snapshot_at` (datetime ISO), `snapshot_by` (string).
`finalize` 시점에 `Units` 행을 그대로 복제해 보관. 학년말 보고·복원 용도.

### 3.7 상수 시트 (변경 없음)

[gas/setup.js](../gas/setup.js)의 `seedConstants_` 참조.

- `Constants_Themes` — `id`, `name_ko`, `name_en`, `old_descriptor`, `new_statement`, `new_bullet_1~3`
- `Constants_KeyConcepts` — `id`, `name_ko`, `name_en`, `key_question_ko`, `key_question_en`, `description_ko`
- `Constants_LearnerProfile` — `id`, `name_en`, `name_ko`, `description_ko`
- `Constants_ATL` — `id`, `category`, `category_ko`, `skill_en`, `skill_ko`
- `Constants_Curriculum2022` — `subject`, `grade_group`, `code`, `statement`

---

## 4. 운영 가이드라인

### 4.1 시트 행 한계 대응

Google Sheets는 한 시트당 1천만 셀 한계가 있다. 본 프로젝트의 병목 후보:

| 시트 | 예상 연 증가 | 권장 분리 시점 |
| ---- | ------------ | -------------- |
| `Comments` | 36 단원 × 10 교사 × 학기 ≈ 수천 | 한 학년도 끝나면 `Comments_Archive_<연도>`로 이전 |
| `Changelog` | 모든 액션 기록 → 수만 행 가능 | `Changelog_Archive_<연도>`로 분리, 활성 시트는 1년치 유지 |

자동 분리는 Phase 2-C 또는 Phase 4 운영 단계에서 GAS 트리거(`onOpen` 또는 시간 기반)로 구현 예정.

### 4.2 권한·소유권

- 시트 직접 편집 권한은 `admin` 2~3명만. 다른 모든 변경은 GAS Web App 경유.
- `onEdit` 트리거로 직접 편집 시 `version`/`updated_at` 자동 갱신 검토 (Phase 4).
- 시트 소유자는 학교 공용 Google 계정 권장 (수석교사 퇴임 대비, 리스크 R8).

### 4.3 백업

- **JSON 내보내기** (Phase 3): 전체 POI를 JSON 단일 파일로 다운로드, 다른 학교/연도 템플릿 import 가능.
- **시트 사본**: Sheets 자체의 "사본 만들기"로 학기별 스냅샷 시트 보관.
- **자동 주간 백업** (Phase 4): GAS 시간 트리거로 Drive에 JSON 덤프.

### 4.4 디버깅

- GAS 로그: `Logger.log(...)` → Apps Script 에디터의 실행 로그.
- 시트 직접 조회: 권한 있는 운영자가 `Comments`, `Changelog`를 필터링해 조회 가능.
- `Changelog`만으로 거의 모든 사용자 행위 재구성 가능 (감사 추적).

---

## 5. v3.1 → v3.2 마이그레이션 (Phase 2-B)

### 5.1 변경 시트
- **`Units`** — `display_order` (number) 컬럼 마지막에 추가
- **`Snapshots`** — `snapshot_id` 앞에 `display_order` 컬럼 삽입
- **`Changelog`** — 컬럼 변경 없음 (`action: 'move'`는 v3.1에서 enum 정의됨)

### 5.2 마이그레이션 시퀀스

```
GAS 에디터에서 migrate_v3_2() 실행
  ├─ migrateUnits_v3_2_()
  │   ├─ display_order 컬럼 추가 (없는 경우)
  │   └─ 같은 (grade, theme_id) 내 created_at 순서로 0,1,2... 자동 부여
  └─ migrateSnapshots_v3_2_()
      └─ snapshot_id 앞에 display_order 컬럼 삽입 (기존 행은 빈 값)
```

> **재실행 안전**: `display_order`에 이미 값이 있는 행은 건너뜁니다. 안심하고 여러 번 실행 가능.

### 5.3 `moveUnit` API 5중 검증

[gas/units.js](../gas/units.js)의 `moveUnit` 함수가 다음을 순차 검증:

| # | 검증 | 위반 시 |
| - | ---- | ------- |
| 1 | 권한 — `editor` 이상 + 본인 소유 또는 `admin` | `FORBIDDEN` |
| 2 | 잠금/상태 — `locked=false` AND `status ∈ {draft, in_review}` | `LOCKED` |
| 3 | 낙관적 락 — `expected_version` 일치 | `CONFLICT` |
| 4 | TDT 균형 — 같은 학년에 동일 `theme_id` 2개 이상 | ⚠️ warning (차단 X) |
| 5 | 학년군 정합성 — `subject_links` 코드 학년군 불일치 | ⚠️ warning (차단 X) |

1~3은 **차단(에러 반환)**, 4~5는 **경고(저장은 진행)**. 학교 정책에 따라 4~5도 차단으로 바꾸려면 [gas/units.js](../gas/units.js)의 `moveUnit`에서 `warnings.push` 대신 `throw appError_('VALIDATION', ...)`로 변경.

---

## 6. 향후 변경 예고

### Phase 4 (운영 고도화)
- `Comments_Archive_<연도>`, `Changelog_Archive_<연도>` 자동 분리 트리거
- `Notifications` 시트 신설 검토 (멘션·미해결 댓글 알림 큐)
- `onEdit` 트리거로 시트 직접 편집 시 정합성 보호

---

## 변경 이력

- **v1.0** (2026-04-27): v3.1 스키마(`commenter` 역할, Comments 확장, `action` enum 확장) 기준으로 신규 작성. v3.0 → v3.1 마이그레이션 가이드 포함.
- **v1.1** (2026-04-28): v3.2 스키마 반영 — `Units.display_order` / `Snapshots.display_order` 추가, `migrate_v3_2()` 함수, `moveUnit` API 5중 검증 표 추가.
- **v1.2** (2026-04-28): v3.3 스키마 반영 — `Units.deleted` / `deleted_at` / `deleted_by` 컬럼 추가, `migrate_v3_3()` 함수, 휴지통 API(deleteUnit/restoreUnit/purgeUnit/getTrash) + Changelog action enum 4종(archive/delete/restore/purge) 추가.
